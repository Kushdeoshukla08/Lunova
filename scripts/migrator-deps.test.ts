/**
 * Proves the production image can actually run `prisma migrate deploy`.
 *
 * Render's free tier has no Shell and no pre-deploy hook, so the container
 * migrates itself on boot. If the image is missing one of the CLI's modules the
 * boot migration fails silently, the app starts anyway, and the database drifts
 * behind the code — which is exactly what happened before this test existed.
 *
 * So: build the runner image's module layout in a temp directory and run a real
 * `migrate deploy` there, against a throwaway database. A Prisma upgrade that
 * needs one more package fails here instead of in production.
 *
 * It has to be `deploy`: `migrate status` is read-only and loads strictly less,
 * and a list probed with it shipped an image that still failed on the write path.
 * Skipped unless RUN_DB_TESTS=1 (needs Postgres on :5433).
 *
 *   RUN_DB_TESTS=1 npx vitest run scripts/migrator-deps
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATOR_BASE_PACKAGES, MIGRATOR_ROOTS, resolveMigratorClosure } from "./migrator-deps.mjs";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

const repo = process.cwd();
/** Throwaway database for the deploy rehearsal; created and dropped per run. */
const SCRATCH_DB = "lunova_migrator_probe";

/** The DATABASE_URL without going through dotenv, whose banner pollutes stdout. */
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(join(repo, ".env"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not set and not present in .env");
  return line.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
}

d("the production image can run prisma migrate", () => {
  let dir = "";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "lunova-runner-"));
    const nm = join(dir, "node_modules");
    mkdirSync(nm, { recursive: true });

    // COPY, do not link. Node resolves a symlinked package to its real path and
    // then walks *up* from there, so a linked tree finds anything in the repo's
    // own node_modules and the test can never detect a missing package — it
    // would pass with an empty list. The first version of this test did exactly
    // that and shipped an image whose migration died on `Cannot find module
    // 'graceful-fs'`. The copy costs ~15s; correctness is worth more.
    const { packages } = resolveMigratorClosure(repo);
    for (const name of [...MIGRATOR_BASE_PACKAGES, ...packages]) {
      const src = join(repo, "node_modules", name);
      const dst = join(nm, name);
      mkdirSync(dirname(dst), { recursive: true });
      cpSync(src, dst, { recursive: true, dereference: true });
    }

    // What the Dockerfile copies alongside node_modules.
    for (const p of ["prisma", "prisma.config.ts", "package.json"]) {
      cpSync(join(repo, p), join(dir, p), { recursive: true, dereference: true });
    }
  }, 120_000);

  afterAll(() => {
    // Best-effort. On Windows the CLI process can still hold a handle for a
    // moment after exit (EBUSY), and failing to delete a temp directory is not
    // a reason to fail the run — the OS reclaims it either way.
    if (!dir) return;
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      /* leave it to the OS */
    }
  });

  it("runs migrate deploy end to end, against an empty database", async () => {
    // `deploy`, not `status`. Status is read-only and loads strictly less — a
    // list built by probing with it passed here and still failed in production,
    // because the write path reaches for modules the read path never touches.
    // A throwaway database means deploy has real work to do.
    const { default: pg } = await import("pg");
    const base = new URL(databaseUrl());
    const admin = new URL(base.toString());
    admin.pathname = "/postgres";
    const target = new URL(base.toString());
    target.pathname = `/${SCRATCH_DB}`;

    const withAdmin = async (sql: string) => {
      const client = new pg.Client({ connectionString: admin.toString() });
      await client.connect();
      try {
        await client.query(sql);
      } finally {
        await client.end();
      }
    };

    await withAdmin(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    await withAdmin(`CREATE DATABASE ${SCRATCH_DB}`);

    try {
      let output: string;
      try {
        output = execFileSync(
          process.execPath,
          // The same invocation docker-entrypoint.sh uses. Not `.bin/prisma`:
          // that is a symlink Docker flattens into a broken copy.
          ["node_modules/prisma/build/index.js", "migrate", "deploy"],
          {
            cwd: dir,
            env: { ...process.env, DATABASE_URL: target.toString() },
            encoding: "utf8",
            stdio: "pipe",
          },
        );
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
        const loadFailure = /Cannot find (?:module|package) '([^']+)'/.exec(output);
        expect(
          loadFailure?.[1] ?? null,
          `the image is missing a module the Prisma CLI needs. Add the package that requires it to MIGRATOR_ROOTS in scripts/migrator-deps.mjs\n\n${output.slice(-800)}`,
        ).toBeNull();
        throw new Error(`migrate deploy failed:\n${output.slice(-800)}`);
      }
      expect(output).toContain("migrations have been successfully applied");
    } finally {
      await withAdmin(`DROP DATABASE IF EXISTS ${SCRATCH_DB} WITH (FORCE)`);
    }
  }, 180_000);

  it("names every package the Dockerfile stages", () => {
    // The Dockerfile calls scripts/migrator-deps.mjs rather than repeating the
    // list, so the image and this test can never disagree about what is in it.
    const dockerfile = readFileSync(join(repo, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("scripts/migrator-deps.mjs");
    const { packages, missing } = resolveMigratorClosure(repo);
    expect(missing, "a root declares a dependency that is not installed").toEqual([]);
    // The closure must be a superset of the observed roots, or the staging step
    // and the probe above are testing different things.
    for (const root of MIGRATOR_ROOTS) expect(packages).toContain(root);
  });
});
