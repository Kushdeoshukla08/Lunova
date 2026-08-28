/**
 * The node_modules the Prisma CLI needs in the production image.
 *
 * WHY THIS EXISTS
 * `next build --output standalone` traces only what the *app* imports. The
 * Prisma CLI is a devDependency, so none of it is traced — but the container
 * has to run `prisma migrate deploy` on boot, because Render's free tier has no
 * Shell and no pre-deploy hook. Copying all of node_modules would add hundreds
 * of megabytes; copying the CLI's declared dependency graph pulls in Studio's
 * React/d3 UI, pglite and mysql2 for nothing.
 *
 * So this is the set the CLI *actually loads* for `migrate deploy`, found by
 * running it in a simulated runner image and adding only what it asked for.
 * `scripts/migrator-deps.test.ts` re-runs that simulation on every test run, so
 * a Prisma upgrade that needs one more package fails in CI rather than silently
 * leaving staging un-migrated.
 *
 * Used two ways:
 *   - Docker build:  node scripts/migrator-deps.mjs <outDir>   (copies them)
 *   - The test:      imports MIGRATOR_PACKAGES and links them
 */
import { cpSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Already copied by the Dockerfile for other reasons (the CLI entry point, the
 * query engine, and the `dotenv/config` that prisma.config.ts imports).
 */
export const MIGRATOR_BASE_PACKAGES = ["prisma", "@prisma", "dotenv"];

/**
 * The rest of what `prisma migrate deploy` loads. Mostly `@prisma/config`'s
 * loader stack: effect + c12 and their runtime dependencies.
 */
export const MIGRATOR_PACKAGES = [
  "c12",
  "confbox",
  "deepmerge-ts",
  "defu",
  "destr",
  "effect",
  "exsolve",
  "fast-check",
  "get-port-please",
  "grammex",
  "graphmatch",
  "pathe",
  "perfect-debounce",
  "pkg-types",
  "proper-lockfile",
  "pure-rand",
  "rc9",
  "remeda",
  "retry",
  "std-env",
  "valibot",
  "zeptomatch",
];

/** Copy the extra packages into `outDir`, preserving the node_modules layout. */
export function stageMigratorDeps(repoRoot, outDir) {
  const copied = [];
  const missing = [];
  for (const name of MIGRATOR_PACKAGES) {
    const src = join(repoRoot, "node_modules", name);
    if (!existsSync(src)) {
      missing.push(name);
      continue;
    }
    const dst = join(outDir, name);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true, dereference: true });
    copied.push(name);
  }
  return { copied, missing };
}

// CLI entry — used from the Dockerfile build stage. Guarded by an exact path
// comparison so importing this module (the test does) never runs or exits.
const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error("usage: node scripts/migrator-deps.mjs <outDir>");
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  const { copied, missing } = stageMigratorDeps(process.cwd(), outDir);
  console.log(`[migrator-deps] staged ${copied.length} packages into ${outDir}`);
  if (missing.length) {
    // A missing package means the image would boot without a working CLI, and
    // the database would silently stay behind. Fail the build instead.
    console.error(`[migrator-deps] MISSING from node_modules: ${missing.join(", ")}`);
    process.exit(1);
  }
}
