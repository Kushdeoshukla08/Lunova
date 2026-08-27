"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { RealtimeEvent } from "@/lib/realtime/types";

type Handler = (e: RealtimeEvent) => void;

interface RealtimeContextValue {
  subscribe: (h: Handler) => () => void;
  connected: boolean;
}

const RealtimeContext = React.createContext<RealtimeContextValue>({
  subscribe: () => () => {},
  connected: false,
});

/**
 * One SSE connection per tab, shared by every component that needs live
 * updates. EventSource reconnects on its own; on each (re)connect we refresh
 * server data so a missed event can never leave the UI stale.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const handlers = React.useRef(new Set<Handler>());
  const [connected, setConnected] = React.useState(false);
  const hadConnection = React.useRef(false);

  React.useEffect(() => {
    const es = new EventSource("/api/realtime");

    es.onopen = () => {
      setConnected(true);
      // Re-sync after a reconnect — never after the very first connect.
      if (hadConnection.current) router.refresh();
      hadConnection.current = true;
    };

    es.onmessage = (msg) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (event.type === "ping") return;
      for (const h of handlers.current) {
        try {
          h(event);
        } catch {
          /* one bad listener must not break the rest */
        }
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [router]);

  const subscribe = React.useCallback((h: Handler) => {
    handlers.current.add(h);
    return () => {
      handlers.current.delete(h);
    };
  }, []);

  const value = React.useMemo(() => ({ subscribe, connected }), [subscribe, connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Subscribe to live events. The callback may change between renders. */
export function useRealtime(onEvent: Handler) {
  const { subscribe } = React.useContext(RealtimeContext);
  // Effect Event: always sees the latest props/state without re-subscribing.
  const handle = React.useEffectEvent((e: RealtimeEvent) => onEvent(e));

  React.useEffect(() => subscribe((e) => handle(e)), [subscribe]);
}

export function useRealtimeConnected(): boolean {
  return React.useContext(RealtimeContext).connected;
}
