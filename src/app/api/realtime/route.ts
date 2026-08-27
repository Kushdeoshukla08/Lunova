import { getCurrentUser } from "@/lib/auth/dal";
import { realtime } from "@/lib/realtime/provider";
import type { RealtimeEvent } from "@/lib/realtime/types";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

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

      const unsubscribe = realtime.subscribe(user.id, send);
      const heartbeat = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);

      teardown = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
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
