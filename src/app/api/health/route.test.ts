/**
 * /api/health response-shape + secret-safety tests.
 *
 * The endpoint is intentionally public, so the decisive assertion is that no
 * secret value can ever appear in its body: not DATABASE_URL, the DB
 * username/password, AUTH_SECRET, METRICS_TOKEN, or any provider key.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRETS = {
  DB_USER: "lunova_app",
  DB_PASSWORD: "TOP_SECRET_DB_PW_do_not_leak",
  AUTH_SECRET: "AUTH_SECRET_do_not_leak_012345678901234567890",
  METRICS_TOKEN: "METRICS_TOKEN_do_not_leak_abcdef",
  RESEND_API_KEY: "re_do_not_leak_1234567890",
};
const DATABASE_URL = `postgresql://${SECRETS.DB_USER}:${SECRETS.DB_PASSWORD}@db.example-staging.neon.tech:5432/lunova_staging?sslmode=require`;

function mockEnv() {
  vi.doMock("@/lib/env", () => ({
    env: {
      APP_ENV: "staging",
      NODE_ENV: "production",
      DATABASE_URL,
      AUTH_SECRET: SECRETS.AUTH_SECRET,
      METRICS_TOKEN: SECRETS.METRICS_TOKEN,
      RESEND_API_KEY: SECRETS.RESEND_API_KEY,
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
          return Promise.resolve([
            { migration_name: "20260827180855_init", finished_at: new Date(1), rolled_back_at: null },
            { migration_name: "20260827205248_match_context", finished_at: new Date(2), rolled_back_at: null },
            { migration_name: "20260828040204_abuse_hardening", finished_at: new Date(3), rolled_back_at: null },
          ]);
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
        applied: 3,
        latest: "20260828040204_abuse_hardening",
        expected: 3,
        upToDate: true,
      },
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
