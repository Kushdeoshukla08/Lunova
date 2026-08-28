import { describe, expect, it, vi } from "vitest";
import {
  ProviderTimeoutError,
  bestEffort,
  isRetryableHttp,
  withRetry,
  withTimeout,
} from "./resilience";

describe("withTimeout", () => {
  it("rejects with ProviderTimeoutError when the promise is too slow", async () => {
    const slow = new Promise((r) => setTimeout(r, 50));
    await expect(withTimeout(slow, 10, "x")).rejects.toBeInstanceOf(ProviderTimeoutError);
  });
  it("passes through a fast resolve", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "x")).resolves.toBe("ok");
  });
});

describe("withRetry", () => {
  it("retries a failing call then succeeds", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (++n < 3) throw new Error("boom");
      return "done";
    });
    const out = await withRetry(fn, { retries: 3, baseDelayMs: 1 });
    expect(out).toBe("done");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after `retries` and throws the last error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("always");
    });
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow("always");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry when `retryable` returns false", async () => {
    const fn = vi.fn(async () => {
      const e = new Error("4xx") as Error & { status: number };
      e.status = 422;
      throw e;
    });
    await expect(
      withRetry(fn, { retries: 3, baseDelayMs: 1, retryable: isRetryableHttp }),
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("bestEffort", () => {
  it("resolves { ok: false } instead of throwing when the call keeps failing", async () => {
    const res = await bestEffort("x", async () => {
      throw new Error("down");
    }, { retries: 1, baseDelayMs: 1 });
    expect(res).toEqual({ ok: false });
  });
  it("resolves { ok: true } on success", async () => {
    expect(await bestEffort("x", async () => "y")).toEqual({ ok: true });
  });
});

describe("isRetryableHttp", () => {
  it("retries 5xx, 429 and network errors; not other 4xx", () => {
    expect(isRetryableHttp(Object.assign(new Error(), { status: 503 }))).toBe(true);
    expect(isRetryableHttp(Object.assign(new Error(), { status: 429 }))).toBe(true);
    expect(isRetryableHttp(Object.assign(new Error(), { status: 400 }))).toBe(false);
    expect(isRetryableHttp(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableHttp(new ProviderTimeoutError("x", 1))).toBe(true);
  });
});
