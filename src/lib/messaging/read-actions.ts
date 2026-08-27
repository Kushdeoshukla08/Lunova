"use server";

import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { markConversationRead } from "@/lib/conversations/service";
import { realtime } from "@/lib/realtime/provider";

/**
 * Mark the other party's messages read and tell them, so their "sent" ticks
 * update without a refresh. Safe to call repeatedly.
 */
export async function markReadAction(conversationId: string): Promise<void> {
  const user = await requireOnboardedUser();
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { match: { select: { userAId: true, userBId: true } } },
  });
  if (!convo) return;
  const { userAId, userBId } = convo.match;
  if (userAId !== user.id && userBId !== user.id) return;

  await markConversationRead(user.id, conversationId);

  const otherId = userAId === user.id ? userBId : userAId;
  await realtime
    .publish(otherId, {
      type: "read",
      conversationId,
      readerId: user.id,
      at: new Date().toISOString(),
    })
    .catch(() => {});
}
