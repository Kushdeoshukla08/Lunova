/**
 * Proves the production image can actually run `prisma migrate deploy`.
 *
 * Render's free tier has no Shell and no pre-deploy hook, so the container
 * migrates itself on boot. If the image is missing one of the CLI's modules the
 * boot migration fails silently, the app starts anyway, and the database drifts
 * behind the code — which is exactly what happened before this test existed.
 *
 * So: build the runner image's module layout in a temp directory (linking, not
 * copying — 43 MB per run would be silly) and run the CLI there. A Prisma
 * upgrade that needs one more package fails here instead of in production.
 *
 * Read-only: uses `migrate status`, never `deploy`.
 * Skipped unless RUN_DB_TESTS=1 (needs Postgres on :5433).
 *
 *   RUN_DB_TESTS=1 npx vitest run scripts/migrator-deps
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATOR_BASE_PACKAGES, MIGRATOR_PACKAGES } from "./migrator-deps.mjs";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

const repo = process.cwd();

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

    // Link rather than copy: module resolution behaves identically and the
    // suite does not spend half a minute duplicating the Prisma engines.
    for (const name of [...MIGRATOR_BASE_PACKAGES, ...MIGRATOR_PACKAGES]) {
      const target = join(repo, "node_modules", name);
      const link = join(nm, name);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(target, link, "junction");
    }

    // What the Dockerfile copies alongside node_modules.
    for (const p of ["prisma", "prisma.config.ts", "package.json"]) {
      cpSync(join(repo, p), join(dir, p), { recursive: true, dereference: true });
    }
  }, 120_000);

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("resolves every module the CLI loads and reaches the database", () => {
    let output: string;
    try {
      output = execFileSync(
        process.execPath,
        // The same invocation docker-entrypoint.sh uses. Not `.bin/prisma`:
        // that is a symlink Docker flattens into a broken copy.
        ["node_modules/prisma/build/index.js", "migrate", "status"],
        {
          cwd: dir,
          env: { ...process.env, DATABASE_URL: databaseUrl() },
          encoding: "utf8",
          stdio: "pipe",
        },
      );
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
      // `migrate status` exits non-zero when migrations are *pending*, which is
      // a legitimate state — only a load failure is a problem here.
      const loadFailure = /Cannot find (module|package) '([^']+)'/.exec(output);
      expect(
        loadFailure?.[2] ?? null,
        `the image is missing a module the Prisma CLI needs — add it to MIGRATOR_PACKAGES in scripts/migrator-deps.mjs\n\n${output.slice(-800)}`,
      ).toBeNull();
    }

    // Reaching either of these means the CLI booted, read the config and the
    // schema, and connected.
    expect(
      /Database schema is up to date|migrations? found in|have not yet been applied/.test(output),
      `unexpected CLI output:\n${output.slice(-800)}`,
    ).toBe(true);
  }, 120_000);

  it("names every package the Dockerfile stages", () => {
    // The Dockerfile calls scripts/migrator-deps.mjs rather than repeating the
    // list, so the image and this test can never disagree about what is in it.
    const dockerfile = readFileSync(join(repo, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("scripts/migrator-deps.mjs");
    expect(MIGRATOR_PACKAGES.length).toBeGreaterThan(0);
  });
});
