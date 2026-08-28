import "server-only";
import { captureError } from "@/lib/observability/errors";
import { metrics } from "@/lib/observability/metrics";

/**
 * Shared resilience helpers for external providers. The rule (docs/DEPLOYMENT.md,
 * product guardrails): a temporarily-failing vendor must never make Lunova
 * unusable. Callers that can tolerate a miss use `bestEffort`; callers that must
 * know the outcome use `withRetry` directly.
 */

export class ProviderTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "ProviderTimeoutError";
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ProviderTimeoutError(label, ms)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export interface RetryOpts {
  retries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  label?: string;
  /** Return false to stop retrying (e.g. a 4xx that won't get better). */
  retryable?: (err: unknown) => boolean;
}

/** Run `fn` with a per-attempt timeout and exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const {
    retries = 2,
    timeoutMs = 8_000,
    baseDelayMs = 250,
    label = "provider call",
    retryable = () => true,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const out = await withTimeout(fn(), timeoutMs, label);
      metrics.increment(
        "lunova_provider_calls_total",
        { label, outcome: attempt === 0 ? "ok" : "ok_after_retry" },
        "External provider calls by outcome",
      );
      return out;
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !retryable(err)) break;
      metrics.increment("lunova_provider_calls_total", { label, outcome: "retry" });
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * baseDelayMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  metrics.increment("lunova_provider_calls_total", { label, outcome: "failed" });
  throw lastErr;
}

/**
 * Fire-and-forget: retry, and if it still fails, log and resolve. The caller's
 * user-facing flow continues regardless.
 */
export async function bestEffort(
  label: string,
  fn: () => Promise<unknown>,
  opts: RetryOpts = {},
): Promise<{ ok: boolean }> {
  try {
    await withRetry(fn, { label, ...opts });
    return { ok: true };
  } catch (err) {
    captureError(err, { scope: `provider.${label}`, fields: { bestEffort: true } });
    return { ok: false };
  }
}

/** True for network / 5xx / 429 — worth retrying. 4xx (except 429) is not. */
export function isRetryableHttp(err: unknown): boolean {
  if (err instanceof ProviderTimeoutError) return true;
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || status >= 500;
  return true; // network errors have no status
}
