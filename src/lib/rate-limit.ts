import "server-only";

/**
 * Rate limiting behind a provider interface. The in-memory adapter is process-local
 * and fine for a single dev/instance; set REDIS_URL and add a Redis adapter for
 * multi-instance production. Never gate safety features (block/report) on this.
 */
export interface RateRule {
  /** Max hits allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, rule: RateRule): Promise<RateResult>;
}

class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  async check(key: string, { limit, windowMs }: RateRule): Promise<RateResult> {
    const now = Date.now();
    const cutoff = now - windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    arr.push(now);
    this.hits.set(key, arr);

    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) {
        if (v.every((t) => t <= cutoff)) this.hits.delete(k);
      }
    }

    return {
      ok: arr.length <= limit,
      remaining: Math.max(0, limit - arr.length),
      resetAt: (arr[0] ?? now) + windowMs,
    };
  }
}

const globalForRl = globalThis as unknown as { rateLimiter?: RateLimiter };

// TODO: when env.REDIS_URL is set, swap in a Redis-backed adapter here.
export const rateLimiter: RateLimiter =
  globalForRl.rateLimiter ?? (globalForRl.rateLimiter = new MemoryRateLimiter());

/** Named presets so limits are consistent and tunable in one place. */
export const RATE_RULES = {
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  loginPerEmail: { limit: 6, windowMs: 15 * 60 * 1000 },
  verifyCode: { limit: 8, windowMs: 15 * 60 * 1000 },
  resendCode: { limit: 4, windowMs: 60 * 60 * 1000 },
  likes: { limit: 200, windowMs: 24 * 60 * 60 * 1000 },
  /** Burst guard on top of the daily cap — stops rapid mass-liking scripts. */
  likesBurst: { limit: 40, windowMs: 60 * 60 * 1000 },
  messages: { limit: 120, windowMs: 60 * 60 * 1000 },
  reports: { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
} satisfies Record<string, RateRule>;
