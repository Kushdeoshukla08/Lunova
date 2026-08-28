/**
 * /api/health response-shape + secret-safety tests.
 *
 * The endpoint is intentionally public, so the decisive assertion is that no
 * secret value can ever appear in its body: not DATABASE_URL, the DB
 * username/password, AUTH_SECRET, METRICS_TOKEN, or any provider key.
 */
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The route counts migration folders on disk, so the fixture is derived from the
 * real directory. Hard-coding a number here just means the test breaks the next
 * time someone adds a migration, which teaches people to edit tests to go green.
 */
const MIGRATION_NAMES = readdirSync(join(process.cwd(), "prisma", "migrations"), {
  withFileTypes: true,
})
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const SECRETS = {
  DB_USER: "lunova_app",
  DB_PASSWORD: "TOP_SECRET_DB_PW_do_not_leak",
  AUTH_SECRET: "AUTH_SECRET_do_not_leak_012345678901234567890",
  METRICS_TOKEN: "METRICS_TOKEN_do_not_leak_abcdef",
  RESEND_API_KEY: "re_do_not_leak_1234567890",
  S3_ACCESS_KEY_ID: "AKIA_do_not_leak_0000",
  S3_SECRET_ACCESS_KEY: "s3secret_do_not_leak_abcdefghijklmnop",
};
const DATABASE_URL = `postgresql://${SECRETS.DB_USER}:${SECRETS.DB_PASSWORD}@db.example-staging.neon.tech:5432/lunova_staging?sslmode=require`;

function mockEnv(overrides: Record<string, unknown> = {}) {
  vi.doMock("@/lib/env", () => ({
    env: {
      APP_ENV: "staging",
      NODE_ENV: "production",
      DATABASE_URL,
      AUTH_SECRET: SECRETS.AUTH_SECRET,
      METRICS_TOKEN: SECRETS.METRICS_TOKEN,
      RESEND_API_KEY: SECRETS.RESEND_API_KEY,
      STORAGE_PROVIDER: "local",
      STORAGE_LOCAL_DIR: ".uploads",
      ...overrides,
    },
    isProdLike: true,
    isProduction: false,
  }));
}

function mockDb(impl: { queryRaw: () => Promise<unknown> }) {
  vi.doMock("@/lib/db", () => ({
    db: {
      $queryRaw: vi.fn((strings: TemplateStringsArray) => {
        const sql = String(strings.raw?.join("") ?? "");
        if (sql.includes("_prisma_migrations")) {
          return Promise.resolve(
            MIGRATION_NAMES.map((migration_name, i) => ({
              migration_name,
              finished_at: new Date(i + 1),
              rolled_back_at: null,
            })),
          );
        }
        return impl.queryRaw();
      }),
    },
  }));
}

async function callHealth() {
  const { GET } = await import("./route");
  const res = await GET();
  const body = await res.json();
  return { res, body, text: JSON.stringify(body) };
}

beforeEach(() => {
  vi.resetModules();
  process.env.BUILD_COMMIT = "abc123def456";
});
afterEach(() => {
  vi.doUnmock("@/lib/env");
  vi.doUnmock("@/lib/db");
  delete process.env.BUILD_COMMIT;
});

describe("GET /api/health — healthy", () => {
  beforeEach(() => {
    mockEnv();
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
  });

  it("returns 200 with the diagnostic shape", async () => {
    const { res, body } = await callHealth();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      db: "up",
      commit: "abc123def456",
      appEnv: "staging",
      nodeEnv: "production",
      database: { host: "db.example-staging.neon.tech", name: "lunova_staging" },
      migrations: {
        applied: MIGRATION_NAMES.length,
        latest: MIGRATION_NAMES.at(-1),
        expected: MIGRATION_NAMES.length,
        upToDate: true,
      },
      storage: { provider: "local", ready: true, missing: [] },
    });
    expect(typeof body.ms).toBe("number");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("body contains NO secret values", async () => {
    const { text, body } = await callHealth();
    for (const [name, value] of Object.entries(SECRETS)) {
      expect(text, `secret ${name} leaked`).not.toContain(value);
    }
    expect(text).not.toContain(DATABASE_URL);
    expect(text).not.toContain("postgresql://");
    expect(text).not.toContain("sslmode");
    // database field is exactly host + name, nothing else
    expect(Object.keys(body.database).sort()).toEqual(["host", "name"]);
  });
});

describe("GET /api/health — boot migration report", () => {
  // The container migrates itself on boot and writes what happened to a file.
  // On a host with no Shell and no log access this is the only way to tell
  // "the migration failed" from "the migration never ran".
  const reportPath = join(tmpdir(), `lunova-migrate-test-${process.pid}.json`);
  afterEach(() => {
    rmSync(reportPath, { force: true });
    delete process.env.MIGRATION_REPORT_PATH;
  });

  it("is absent when the entrypoint did not run (local dev)", async () => {
    process.env.MIGRATION_REPORT_PATH = join(tmpdir(), "definitely-not-here.json");
    mockEnv();
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
    const { body } = await callHealth();
    expect(body.bootMigration).toBeUndefined();
  });

  it("surfaces a failed boot migration with its reason", async () => {
    writeFileSync(
      reportPath,
      JSON.stringify({
        ran: true,
        exitCode: 1,
        at: "2026-08-28T17:32:13Z",
        entrypoint: "ran",
        reason: "Error: P1001: Can't reach database server",
      }),
    );
    process.env.MIGRATION_REPORT_PATH = reportPath;
    mockEnv();
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
    const { body } = await callHealth();
    expect(body.bootMigration).toEqual({
      ran: true,
      exitCode: 1,
      at: "2026-08-28T17:32:13Z",
      entrypoint: "ran",
      reason: "Error: P1001: Can't reach database server",
    });
  });

  it("exposes only known keys, whatever the file contains", async () => {
    // The file is written by a shell script; treat it as untrusted input rather
    // than spreading it into a public, unauthenticated response.
    writeFileSync(
      reportPath,
      JSON.stringify({
        ran: true,
        exitCode: 0,
        at: "2026-08-28T17:32:08Z",
        entrypoint: "ran",
        DATABASE_URL: `postgresql://u:${SECRETS.DB_PASSWORD}@h/db`,
        AUTH_SECRET: SECRETS.AUTH_SECRET,
      }),
    );
    process.env.MIGRATION_REPORT_PATH = reportPath;
    mockEnv();
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
    const { body, text } = await callHealth();
    expect(Object.keys(body.bootMigration).sort()).toEqual([
      "at",
      "entrypoint",
      "exitCode",
      "ran",
    ]);
    expect(text).not.toContain(SECRETS.DB_PASSWORD);
    expect(text).not.toContain(SECRETS.AUTH_SECRET);
  });

  it("ignores a corrupt report rather than failing the probe", async () => {
    writeFileSync(reportPath, "not json {{{");
    process.env.MIGRATION_REPORT_PATH = reportPath;
    mockEnv();
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
    const { res, body } = await callHealth();
    expect(res.status).toBe(200);
    expect(body.bootMigration).toBeUndefined();
  });
});

describe("GET /api/health — storage readiness", () => {
  it("names the MISSING S3 variables, and never their values", async () => {
    mockEnv({
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: "",
      S3_ACCESS_KEY_ID: "",
      S3_SECRET_ACCESS_KEY: "",
    });
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
    const { res, body } = await callHealth();
    expect(res.status).toBe(200);
    expect(body.storage).toEqual({
      provider: "s3",
      ready: false,
      missing: ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    });
  });

  it("reports ready without echoing the configured credentials", async () => {
    mockEnv({
      STORAGE_PROVIDER: "s3",
      S3_BUCKET: "lunova-staging-media",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      S3_ACCESS_KEY_ID: SECRETS.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: SECRETS.S3_SECRET_ACCESS_KEY,
    });
    mockDb({ queryRaw: () => Promise.resolve([{ "?column?": 1 }]) });
    const { body, text } = await callHealth();
    expect(body.storage).toEqual({ provider: "s3", ready: true, missing: [] });
    expect(text).not.toContain(SECRETS.S3_ACCESS_KEY_ID);
    expect(text).not.toContain(SECRETS.S3_SECRET_ACCESS_KEY);
  });
});

describe("GET /api/health — db down", () => {
  beforeEach(() => {
    mockEnv();
    mockDb({ queryRaw: () => Promise.reject(new Error(`connect ECONNREFUSED ${DATABASE_URL}`)) });
  });

  it("returns 503 and still exposes no secrets", async () => {
    const { res, body, text } = await callHealth();
    expect(res.status).toBe(503);
    expect(body).toMatchObject({ ok: false, db: "down", appEnv: "staging" });
    expect(body.database).toEqual({ host: "db.example-staging.neon.tech", name: "lunova_staging" });
    for (const value of Object.values(SECRETS)) {
      expect(text).not.toContain(value);
    }
    expect(text).not.toContain("postgresql://");
  });
});

describe("GET /api/health — migrations table missing", () => {
  beforeEach(() => {
    mockEnv();
    vi.doMock("@/lib/db", () => ({
      db: {
        $queryRaw: vi.fn((strings: TemplateStringsArray) => {
          const sql = String(strings.raw?.join("") ?? "");
          if (sql.includes("_prisma_migrations")) {
            return Promise.reject(new Error('relation "_prisma_migrations" does not exist'));
          }
          return Promise.resolve([{ "?column?": 1 }]);
        }),
      },
    }));
  });

  it("still returns 200; migrations reported as unavailable", async () => {
    const { res, body } = await callHealth();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.migrations).toEqual({ error: "unavailable" });
  });
});
