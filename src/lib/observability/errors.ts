import "server-only";
import { env } from "@/lib/env";
import { log } from "./logger";
import { metrics } from "./metrics";

/**
 * One funnel for unexpected failures. Today it produces a structured error log
 * and bumps a counter; when `SENTRY_DSN` is set, `forward()` is where a real
 * error tracker plugs in (send the already-redacted payload — do not hand it the
 * raw error with request data attached).
 */

export interface ErrorContext {
  /** Where it happened, e.g. "provider.email.send", "route./discover". */
  scope: string;
  /** Safe, non-PII extras. Redaction still runs in the logger. */
  fields?: Record<string, unknown>;
}

/** A stable-ish grouping key so the same failure aggregates. */
function fingerprint(err: unknown, scope: string): string {
  const name = err instanceof Error ? err.name : typeof err;
  const msg = err instanceof Error ? err.message : String(err);
  const head = msg.replace(/\d+/g, "#").slice(0, 80);
  return `${scope}:${name}:${head}`;
}

export function captureError(err: unknown, ctx: ErrorContext): void {
  const fp = fingerprint(err, ctx.scope);
  metrics.increment(
    "lunova_errors_total",
    { scope: ctx.scope },
    "Unexpected errors funnelled through captureError",
  );

  log.error("unhandled error", {
    scope: ctx.scope,
    fingerprint: fp,
    error: err instanceof Error ? err.name : typeof err,
    detail: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    ...ctx.fields,
  });

  if (env.SENTRY_DSN) forward(err, ctx, fp);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function forward(_err: unknown, _ctx: ErrorContext, _fingerprint: string): void {
  // Drop-in point for Sentry / GlitchTip / Highlight. Intentionally a no-op
  // until a DSN is configured AND an SDK is added — we don't ship a vendor SDK
  // in the base image. See docs/OBSERVABILITY.md.
}
