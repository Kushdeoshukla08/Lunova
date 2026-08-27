import "server-only";
import { db } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/enums";

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
    console.error("notify failed", err);
  }
}
