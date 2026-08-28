import "server-only";
import { db } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/enums";
import { captureError } from "@/lib/observability/errors";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listNotifications(
  userId: string,
  { limit = 40 }: { limit?: number } = {},
): Promise<NotificationItem[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
  });
  return rows.map((r) => ({
    ...r,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
  }));
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db.notification
    .updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
    .catch(() => {});
}

/** Resolve a link + the display copy for a notification. */
export async function decorateNotifications(
  userId: string,
  items: NotificationItem[],
): Promise<
  (NotificationItem & { href: string; title: string; body?: string; who?: string })[]
> {
  const userIds = new Set<string>();
  for (const n of items) {
    const p = n.payload ?? {};
    for (const k of ["fromUserId", "withUserId"]) {
      if (typeof p[k] === "string") userIds.add(p[k] as string);
    }
  }
  const names = new Map<string, string>();
  if (userIds.size) {
    const profiles = await db.profile.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, displayName: true },
    });
    for (const p of profiles) names.set(p.userId, p.displayName);
  }

  return items.map((n) => {
    const p = n.payload ?? {};
    const who =
      names.get((p.fromUserId as string) ?? (p.withUserId as string) ?? "") ?? "Someone";
    switch (n.type) {
      case "NEW_MATCH":
        return {
          ...n,
          who,
          href: p.matchId ? `/connections` : "/connections",
          title: `You matched with ${who}`,
          body: "Say something specific from their profile.",
        };
      case "NEW_MESSAGE":
        return {
          ...n,
          who,
          href: p.conversationId ? `/connections/${p.conversationId}` : "/connections",
          title: `${who} sent you a message`,
        };
      case "NEW_LIKE":
        return {
          ...n,
          who,
          href: "/discover",
          title: `${who} liked you`,
          body: typeof p.comment === "string" ? `“${p.comment}”` : undefined,
        };
      case "VERIFICATION_COMPLETE":
        return { ...n, href: "/settings", title: "Verification approved" };
      case "VERIFICATION_REJECTED":
        return { ...n, href: "/verify/photo", title: "Verification needs another try" };
      case "SECURITY_ALERT":
        return { ...n, href: "/settings/security", title: "Security alert on your account" };
      case "SAFETY_UPDATE":
        return { ...n, href: "/settings", title: "An update from our safety team" };
      default:
        return { ...n, href: "/discover", title: "Lunova" };
    }
  });
}

const PREF_KEY: Record<string, keyof PrefRow | null> = {
  NEW_LIKE: "newLike",
  NEW_MATCH: "newMatch",
  NEW_MESSAGE: "newMessage",
  VERIFICATION_COMPLETE: "safety",
  VERIFICATION_REJECTED: "safety",
  SECURITY_ALERT: "security",
  SAFETY_UPDATE: "safety",
  PRODUCT: "product",
};

type PrefRow = {
  newLike: boolean;
  newMatch: boolean;
  newMessage: boolean;
  safety: boolean;
  security: boolean;
  product: boolean;
};

/**
 * Create an in-app notification, honouring the user's per-type preference.
 * Delivery to email/push is a separate concern (provider stub) — this is the
 * durable record the app reads.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    const key = PREF_KEY[type];
    if (key) {
      const pref = await db.notificationPreference.findUnique({
        where: { userId },
        select: { [key]: true } as Record<string, true>,
      });
      if (pref && (pref as Record<string, boolean>)[key] === false) return;
    }
    await db.notification.create({
      data: { userId, type, payload: payload as object | undefined },
    });
  } catch (err) {
    captureError(err, { scope: "notifications.notify" });
  }
}
