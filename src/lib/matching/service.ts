import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/service";
import type { LikeKind } from "@/generated/prisma/enums";

export interface LikeOutcome {
  matched: boolean;
  matchId?: string;
  conversationId?: string;
  otherName?: string;
}

/** Ordered pair so a Match row is unique regardless of who liked first. */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Record a like or pass and, on a mutual like, create the Match + Conversation
 * atomically. Safe under a race (unique constraints on Like and Match).
 */
export async function recordLikeAndMaybeMatch(input: {
  actorId: string;
  targetId: string;
  kind: LikeKind;
  comment?: string | null;
  elementRef?: string | null;
}): Promise<LikeOutcome> {
  const { actorId, targetId, kind, comment, elementRef } = input;

  await db.like.upsert({
    where: { actorId_targetId: { actorId, targetId } },
    create: { actorId, targetId, kind, comment: comment ?? null, elementRef: elementRef ?? null },
    update: { kind, comment: comment ?? null, elementRef: elementRef ?? null },
  });

  if (kind === "PASS") return { matched: false };

  const reciprocal = await db.like.findUnique({
    where: { actorId_targetId: { actorId: targetId, targetId: actorId } },
    select: { kind: true },
  });

  if (!reciprocal || reciprocal.kind !== "LIKE") {
    await notify(targetId, "NEW_LIKE", { fromUserId: actorId, comment: comment ?? undefined });
    return { matched: false };
  }

  const [userAId, userBId] = orderedPair(actorId, targetId);

  const match = await db.$transaction(async (tx) => {
    const existing = await tx.match.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true, conversation: { select: { id: true } } },
    });
    if (existing) return existing;

    const created = await tx.match.create({
      data: {
        userAId,
        userBId,
        conversation: { create: {} },
      },
      select: { id: true, conversation: { select: { id: true } } },
    });
    await tx.message.create({
      data: {
        conversationId: created.conversation!.id,
        systemType: "MATCH_CREATED",
        body: "You connected on Lunova. Say something real.",
      },
    });
    return created;
  });

  const [actorProfile, targetProfile] = await Promise.all([
    db.profile.findUnique({ where: { userId: actorId }, select: { displayName: true } }),
    db.profile.findUnique({ where: { userId: targetId }, select: { displayName: true } }),
  ]);

  await Promise.all([
    notify(actorId, "NEW_MATCH", { matchId: match.id, withUserId: targetId }),
    notify(targetId, "NEW_MATCH", { matchId: match.id, withUserId: actorId }),
  ]);

  return {
    matched: true,
    matchId: match.id,
    conversationId: match.conversation?.id,
    otherName: targetProfile?.displayName ?? actorProfile?.displayName ?? "someone",
  };
}
