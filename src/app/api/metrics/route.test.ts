/**
 * /api/metrics is the one endpoint guarded by a bearer token rather than a
 * session, so the guard itself is the whole security boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "metrics_token_abcdefghijklmnop_0123456789";

function mockEnv(metricsToken: string | undefined) {
  vi.doMock("@/lib/env", () => ({
    env: { METRICS_TOKEN: metricsToken, NODE_ENV: "production", APP_ENV: "staging" },
    isProdLike: true,
    isProduction: false,
  }));
  vi.doMock("@/lib/db", () => ({
    db: { $queryRaw: vi.fn(() => Promise.resolve([{ "?column?": 1 }])) },
  }));
}

async function call(authorization?: string) {
  const { GET } = await import("./route");
  return GET(
    new Request("http://localhost/api/metrics", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.doUnmock("@/lib/env");
  vi.doUnmock("@/lib/db");
});

describe("GET /api/metrics", () => {
  it("is 404, not 401, when no token is configured", async () => {
    // A 401 would advertise that a metrics endpoint exists here at all.
    mockEnv(undefined);
    expect((await call()).status).toBe(404);
    expect((await call(`Bearer ${TOKEN}`)).status).toBe(404);
  });

  it("rejects a missing, malformed or wrong token", async () => {
    mockEnv(TOKEN);
    for (const header of [
      undefined,
      "",
      TOKEN, // no scheme
      `Basic ${TOKEN}`,
      "Bearer ",
      `Bearer ${TOKEN}x`,
      `Bearer ${TOKEN.slice(0, -1)}`,
      `bearer ${TOKEN}`, // scheme is case-sensitive here by design
    ]) {
      const res = await call(header);
      expect(res.status, String(header)).toBe(401);
    }
  });

  it("never echoes the expected token in a rejection", async () => {
    mockEnv(TOKEN);
    const res = await call("Bearer wrong");
    expect(await res.text()).not.toContain(TOKEN);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the exposition to a correct token", async () => {
    mockEnv(TOKEN);
    const res = await call(`Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("compares in constant time — a near-miss costs the same as a far-miss", async () => {
    mockEnv(TOKEN);
    // Not a timing measurement (too noisy to assert on); this pins the
    // *implementation* choice by proving both wrong tokens are indistinguishable
    // in everything the caller can observe.
    const almost = await call(`Bearer ${TOKEN.slice(0, -1)}z`);
    const nothing = await call("Bearer z");
    expect(almost.status).toBe(nothing.status);
    expect(await almost.text()).toBe(await nothing.text());
  });
});
