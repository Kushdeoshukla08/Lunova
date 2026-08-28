"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { rateLimiter, RATE_RULES } from "@/lib/rate-limit";
import { moderateText } from "@/lib/moderation/provider";
import { notify } from "@/lib/notifications/service";
import { realtime } from "@/lib/realtime/provider";
import { messageSchema } from "@/lib/validation/safety";
import { isBlockedEitherWay } from "@/lib/safety/service";
import { recordSafetyEvent } from "@/lib/safety/events";
import { metrics } from "@/lib/observability/metrics";

/**
 * How many consecutive un-answered messages one person may send before we stop
 * them. A real opener is a line or two; a dozen with zero reply is someone
 * hammering a stranger who isn't responding.
 */
const UNANSWERED_LIMIT = 12;

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendMessageAction(
  raw: { conversationId: string; body: string },
): Promise<SendResult> {
  const user = await requireOnboardedUser();
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }
  const { conversationId, body } = parsed.data;

  const limit = await rateLimiter.check(`msg:${user.id}`, RATE_RULES.messages);
  if (!limit.ok) {
    return { ok: false, error: "You're sending messages very fast — slow down a touch." };
  }

  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      match: { select: { userAId: true, userBId: true, closedAt: true } },
    },
  });
  if (!convo) return { ok: false, error: "This conversation isn't available." };
  const { match } = convo;
  if (match.userAId !== user.id && match.userBId !== user.id) {
    return { ok: false, error: "This conversation isn't available." };
  }
  if (match.closedAt) {
    return { ok: false, error: "This conversation has ended." };
  }
  const otherId = match.userAId === user.id ? match.userBId : match.userAId;

  // Defence in depth: a block normally closes the match, but never rely on a
  // single mechanism for a safety-critical check.
  if (await isBlockedEitherWay(user.id, otherId)) {
    return { ok: false, error: "This conversation isn't available." };
  }

  // One-sided flood guard: count this sender's messages since the other
  // person's last reply (or the start of the thread).
  const lastFromOther = await db.message.findFirst({
    where: { conversationId, senderId: otherId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const unanswered = await db.message.count({
    where: {
      conversationId,
      senderId: user.id,
      deletedAt: null,
      ...(lastFromOther ? { createdAt: { gt: lastFromOther.createdAt } } : {}),
    },
  });
  if (unanswered >= UNANSWERED_LIMIT) {
    await recordSafetyEvent({
      userId: user.id,
      type: "MESSAGE_SPAM_SUSPECTED",
      severity: "LOW",
      source: "matching",
      metadata: { conversationId, unanswered },
    });
    metrics.increment("lunova_message_flood_blocked_total", {}, "One-sided message floods stopped");
    return {
      ok: false,
      error: "Give them a chance to reply before sending more.",
    };
  }

  const verdict = await moderateText(body, "message");
  if (verdict.action === "reject") {
    return { ok: false, error: "That message can't be sent." };
  }

  const message = await db.message.create({
    data: { conversationId, senderId: user.id, body },
    select: { id: true, createdAt: true },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await notify(otherId, "NEW_MESSAGE", { conversationId, fromUserId: user.id });

  // Push to both sides: the recipient gets the message, the sender's other
  // tabs stay in sync. Best-effort — delivery is never load-bearing.
  await realtime
    .publish(otherId, {
      type: "message",
      conversationId,
      messageId: message.id,
      senderId: user.id,
      body,
      createdAt: message.createdAt.toISOString(),
    })
    .catch(() => {});

  revalidatePath(`/connections/${conversationId}`);
  revalidatePath("/connections");
  return { ok: true, id: message.id };
}
