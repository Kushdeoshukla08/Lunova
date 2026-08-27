import { realtime } from "@/lib/realtime/provider";
import { env } from "@/lib/env";
import type { RealtimeEvent } from "@/lib/realtime/types";

/**
 * DEVELOPMENT ONLY — lets scripts/realtime-poke.ts fan an event out through the
 * server's in-process realtime provider so live updates can be exercised
 * without a second browser session. Returns 404 outside development.
 */
export async function POST(request: Request) {
  if (env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }
  const { userId, event } = (await request.json()) as {
    userId?: string;
    event?: RealtimeEvent;
  };
  if (!userId || !event) return new Response("Bad request", { status: 400 });

  await realtime.publish(userId, event);
  return Response.json({ delivered: realtime.connectionCount(userId) });
}
