import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  resolveBuildCommit,
  sanitizeDatabaseUrl,
} from "@/lib/observability/health-info";
import { storageStatus } from "@/lib/providers/storage";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe AND a safe deployment-diagnostics endpoint.
 *
 * Intentionally UNAUTHENTICATED — a load balancer / uptime monitor must be able
 * to hit it. It therefore exposes only secret-free identity: the running commit,
 * the deploy tier (APP_ENV), and the database host + name (not a credential;
 * access still needs auth). It NEVER exposes DATABASE_URL, the DB username or
 * password, AUTH_SECRET, METRICS_TOKEN, or any provider key.
 *
 * 200 when the process is up AND a Postgres round-trip succeeds; 503 otherwise.
 */
export async function GET() {
  const started = Date.now();

  const base = {
    commit: resolveBuildCommit(),
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    database: sanitizeDatabaseUrl(env.DATABASE_URL), // { host, name } | null
    // Which media backend is live and, if it is misconfigured, the NAMES of the
    // variables that are missing — never their values. Without this a bad deploy
    // looks healthy right up until someone opens a profile and sees broken images.
    storage: storageStatus(),
  };

  try {
    await db.$queryRaw`SELECT 1`;
    const [migrations, boot] = await Promise.all([migrationStatus(), bootMigration()]);
    return Response.json(
      {
        ok: true,
        db: "up",
        ms: Date.now() - started,
        ...base,
        migrations,
        // null unless the container entrypoint ran; see bootMigration().
        ...(boot ? { bootMigration: boot } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, db: "down", ms: Date.now() - started, ...base },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

interface MigrationStatus {
  /** Migrations recorded as applied (finished, not rolled back). */
  applied: number;
  /** Most recent applied migration name, or null. */
  latest: string | null;
  /** Migration folders shipped in this build. */
  expected: number;
  /** true when applied >= expected and none are rolled back. */
  upToDate: boolean;
}

async function migrationStatus(): Promise<MigrationStatus | { error: string }> {
  try {
    const rows = await db.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM _prisma_migrations
      ORDER BY finished_at ASC NULLS LAST
    `;
    const applied = rows.filter((r) => r.finished_at && !r.rolled_back_at);
    const rolledBack = rows.some((r) => r.rolled_back_at);
    const expected = await countMigrationDirs();
    return {
      applied: applied.length,
      latest: applied.at(-1)?.migration_name ?? null,
      expected,
      upToDate: !rolledBack && applied.length >= expected && expected > 0,
    };
  } catch {
    // No _prisma_migrations table, or fs unavailable — report, don't crash.
    return { error: "unavailable" };
  }
}

/**
 * What the entrypoint's boot migration did, as written by docker-entrypoint.sh.
 *
 * On a host with no Shell and no log access, this is the only way to tell
 * "the migration failed" from "the migration never ran" — which are very
 * different problems (a broken image vs. an overridden container command).
 * Absent in local dev and anywhere the entrypoint isn't used.
 */
async function bootMigration(): Promise<Record<string, unknown> | null> {
  try {
    // turbopackIgnore: the path is runtime state written by the entrypoint after
    // the build. Without this the bundler traces the whole project into the
    // standalone output "just in case".
    const raw = await readFile(
      /* turbopackIgnore: true */ process.env.MIGRATION_REPORT_PATH ||
        "/tmp/lunova-migrate.json",
      "utf8",
    );
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    // Re-shape rather than spreading, so this can only ever expose these keys.
    const { ran, exitCode, at, entrypoint, reason } = parsed as Record<string, unknown>;
    return { ran, exitCode, at, entrypoint, ...(reason ? { reason } : {}) };
  } catch {
    return null;
  }
}

async function countMigrationDirs(): Promise<number> {
  try {
    const entries = await readdir(join(process.cwd(), "prisma", "migrations"), {
      withFileTypes: true,
    });
    return entries.filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}
