"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { rateLimiter, RATE_RULES } from "@/lib/rate-limit";
import { moderateText } from "@/lib/moderation/provider";
import { notify } from "@/lib/notifications/service";
import { messageSchema } from "@/lib/validation/safety";

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

  const verdict = await moderateText(body, "message");
  if (verdict.action === "reject") {
    return { ok: false, error: "That message can't be sent." };
  }

  const message = await db.message.create({
    data: { conversationId, senderId: user.id, body },
    select: { id: true },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await notify(otherId, "NEW_MESSAGE", { conversationId, fromUserId: user.id });

  revalidatePath(`/connections/${conversationId}`);
  revalidatePath("/connections");
  return { ok: true, id: message.id };
}
