"use client";

import { useEffect } from "react";
import { setTimeZoneAction } from "@/lib/i18n/actions";

/**
 * Fire-and-forget: on first mount, tell the server the browser's timezone if the
 * cookie is missing or stale, so server-rendered dates match the viewer's zone.
 * Renders nothing.
 */
export function TimeZoneSync({ current }: { current: string }) {
  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (tz && tz !== current) void setTimeZoneAction(tz);
  }, [current]);
  return null;
}
