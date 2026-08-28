import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe for load balancers and uptime monitoring.
 * 200 only when the process is up AND a Postgres round-trip succeeds.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { ok: true, db: "up", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
