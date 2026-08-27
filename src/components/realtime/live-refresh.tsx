"use client";

import { useRouter } from "next/navigation";
import { useRealtime } from "./realtime-provider";
import type { RealtimeEvent } from "@/lib/realtime/types";

/**
 * Refreshes the current route when a relevant live event arrives. Drop this in
 * a server-rendered page that should stay current (connections list, nav
 * badges) — the server stays the source of truth.
 */
export function LiveRefresh({
  on = ["message", "match", "read", "notification"],
}: {
  on?: RealtimeEvent["type"][];
}) {
  const router = useRouter();
  useRealtime((event) => {
    if (on.includes(event.type)) router.refresh();
  });
  return null;
}
