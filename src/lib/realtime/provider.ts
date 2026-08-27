import "server-only";
import type { RealtimeEvent, RealtimeProvider } from "./types";

/**
 * Realtime behind a provider interface. The in-process adapter fans out to
 * connections held by *this* server process — correct for a single instance and
 * for local development. For multi-instance production, add a Redis pub/sub
 * adapter here (same interface, publish → channel, subscribe → channel) and
 * nothing in feature code changes.
 */
class InProcessRealtimeProvider implements RealtimeProvider {
  readonly name = "in-process";
  private subscribers = new Map<string, Set<(e: RealtimeEvent) => void>>();

  async publish(userId: string, event: RealtimeEvent): Promise<void> {
    const set = this.subscribers.get(userId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(event);
      } catch {
        /* a dead connection must never break a mutation */
      }
    }
  }

  subscribe(userId: string, onEvent: (e: RealtimeEvent) => void): () => void {
    let set = this.subscribers.get(userId);
    if (!set) {
      set = new Set();
      this.subscribers.set(userId, set);
    }
    set.add(onEvent);
    return () => {
      set!.delete(onEvent);
      if (set!.size === 0) this.subscribers.delete(userId);
    };
  }

  connectionCount(userId: string): number {
    return this.subscribers.get(userId)?.size ?? 0;
  }
}

const g = globalThis as unknown as { realtime?: RealtimeProvider };
export const realtime: RealtimeProvider =
  g.realtime ?? (g.realtime = new InProcessRealtimeProvider());

/** Publish to several users at once. Best-effort. */
export async function publishToMany(
  userIds: string[],
  event: RealtimeEvent,
): Promise<void> {
  await Promise.all(userIds.map((id) => realtime.publish(id, event).catch(() => {})));
}
