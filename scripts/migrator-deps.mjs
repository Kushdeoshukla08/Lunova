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
 *   - The test:      imports resolveMigratorClosure() and copies the same set
 */
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Already copied by the Dockerfile for other reasons (the CLI entry point, the
 * query engine, and the `dotenv/config` that prisma.config.ts imports).
 */
export const MIGRATOR_BASE_PACKAGES = ["prisma", "@prisma", "dotenv"];

/**
 * The subgraphs the CLI enters, found by running `migrate deploy` in a
 * reconstructed runner image and adding only what it asked for. Mostly
 * `@prisma/config`'s loader stack: effect + c12.
 *
 * These are ROOTS, not the final list. What actually gets copied is their
 * transitive `dependencies` closure (see `resolveMigratorClosure`) — a leaf that
 * one of these requires only on Linux, or only under a lock, is invisible to a
 * probe run on a developer's machine. That is not hypothetical: a hand-written
 * leaf list shipped an image whose migration died on `Cannot find module
 * 'graceful-fs'`, which `proper-lockfile` declares and only reaches for in the
 * container.
 */
export const MIGRATOR_ROOTS = [
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

/**
 * The roots plus everything they declare, transitively, resolved against the
 * installed tree so npm's hoisting is respected.
 *
 * Deliberately follows `dependencies` only: `devDependencies` are not installed
 * for a consumer, and `optionalDependencies` are allowed to be absent.
 */
export function resolveMigratorClosure(repoRoot) {
  const nodeModules = join(repoRoot, "node_modules");
  const resolved = new Set();
  const missing = new Set();

  const visit = (name) => {
    if (resolved.has(name) || missing.has(name)) return;
    const manifest = join(nodeModules, name, "package.json");
    if (!existsSync(manifest)) {
      missing.add(name);
      return;
    }
    resolved.add(name);
    const json = JSON.parse(readFileSync(manifest, "utf8"));
    for (const dep of Object.keys(json.dependencies ?? {})) visit(dep);
  };

  for (const root of MIGRATOR_ROOTS) visit(root);
  return { packages: [...resolved].sort(), missing: [...missing] };
}

/** Copy the closure into `outDir`, preserving the node_modules layout. */
export function stageMigratorDeps(repoRoot, outDir) {
  const { packages, missing } = resolveMigratorClosure(repoRoot);
  for (const name of packages) {
    const src = join(repoRoot, "node_modules", name);
    const dst = join(outDir, name);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true, dereference: true });
  }
  return { copied: packages, missing };
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
