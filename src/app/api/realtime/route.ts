import { getCurrentUser } from "@/lib/auth/dal";
import { realtime } from "@/lib/realtime/provider";
import type { RealtimeEvent } from "@/lib/realtime/types";
import { metrics } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/**
 * A single browser opens one connection per tab. A handful of tabs is normal;
 * dozens is not, and an unbounded count is a cheap way to exhaust server
 * sockets. Cap concurrent streams per user — the client reconnects and
 * re-syncs from the server, so a rejected extra stream degrades gracefully.
 */
const MAX_STREAMS_PER_USER = 8;
const streamsByUser = new Map<string, number>();

/**
 * Server-Sent Events stream for the signed-in user. One connection per tab;
 * EventSource reconnects on its own, and the client re-syncs from the server on
 * reconnect so no single event is load-bearing.
 *
 * Authorization is per-connection: events are only ever published to a userId,
 * and this route subscribes strictly to the authenticated user's own channel.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const active = streamsByUser.get(user.id) ?? 0;
  if (active >= MAX_STREAMS_PER_USER) {
    metrics.increment(
      "lunova_sse_rejected_total",
      {},
      "SSE connections rejected for exceeding the per-user cap",
    );
    log.warn("sse connection cap hit", { userScope: "realtime", active });
    return new Response("Too many streams", { status: 429, headers: { "Retry-After": "30" } });
  }

  const encoder = new TextEncoder();
  let teardown = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const send = (event: RealtimeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // opening comment flushes headers through proxies
      controller.enqueue(encoder.encode(": connected\n\n"));

      streamsByUser.set(user.id, (streamsByUser.get(user.id) ?? 0) + 1);
      metrics.addGauge("lunova_sse_connections", 1, {}, "Open SSE connections");

      const unsubscribe = realtime.subscribe(user.id, send);
      const heartbeat = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);

      teardown = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        const next = (streamsByUser.get(user.id) ?? 1) - 1;
        if (next <= 0) streamsByUser.delete(user.id);
        else streamsByUser.set(user.id, next);
        metrics.addGauge("lunova_sse_connections", -1);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", teardown);
    },
    cancel() {
      teardown();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
