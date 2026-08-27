import { describe, expect, it, vi } from "vitest";
import { rateLimiter, RATE_RULES } from "./rate-limit";

describe("MemoryRateLimiter", () => {
  it("allows up to the limit, then blocks", async () => {
    const key = `test:${Math.random()}`;
    const rule = { limit: 3, windowMs: 60_000 };
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push((await rateLimiter.check(key, rule)).ok);
    }
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("reports remaining allowance", async () => {
    const key = `test:${Math.random()}`;
    const rule = { limit: 2, windowMs: 60_000 };
    expect((await rateLimiter.check(key, rule)).remaining).toBe(1);
    expect((await rateLimiter.check(key, rule)).remaining).toBe(0);
  });

  it("frees up allowance once the window passes", async () => {
    vi.useFakeTimers();
    try {
      const key = `test:${Math.random()}`;
      const rule = { limit: 1, windowMs: 1_000 };
      expect((await rateLimiter.check(key, rule)).ok).toBe(true);
      expect((await rateLimiter.check(key, rule)).ok).toBe(false);
      vi.advanceTimersByTime(1_500);
      expect((await rateLimiter.check(key, rule)).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ships sane named presets", () => {
    expect(RATE_RULES.login.limit).toBeGreaterThan(0);
    expect(RATE_RULES.signup.windowMs).toBeGreaterThan(0);
  });
});
