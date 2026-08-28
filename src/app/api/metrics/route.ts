import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { metrics } from "@/lib/observability/metrics";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * `a !== b` on a secret leaks its prefix through response timing: the comparison
 * stops at the first differing byte. Hash both sides to a fixed length first so
 * the comparison itself is constant-time regardless of input length.
 */
function tokenMatches(presented: string | null, expected: string): boolean {
  if (!presented) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

/**
 * Prometheus exposition of the in-process system metrics. Disabled unless
 * METRICS_TOKEN is set; requires `Authorization: Bearer <METRICS_TOKEN>`.
 * Contains no per-user data — only counters, gauges and latency histograms.
 */
export async function GET(request: Request) {
  const token = env.METRICS_TOKEN;
  if (!token) return new Response("metrics disabled", { status: 404 });

  if (!tokenMatches(request.headers.get("authorization"), `Bearer ${token}`)) {
    return new Response("unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // Refresh a couple of gauges that are cheap to sample on scrape.
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    metrics.observe("lunova_db_ping_ms", Date.now() - start, {}, "Postgres round-trip latency (ms)");
    metrics.setGauge("lunova_db_up", 1, {}, "1 if the last DB ping succeeded");
  } catch {
    metrics.setGauge("lunova_db_up", 0, {}, "1 if the last DB ping succeeded");
  }

  return new Response(metrics.render(), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
