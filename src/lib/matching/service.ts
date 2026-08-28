import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications/service";
import { loadCompatInput } from "@/lib/compatibility/load";
import { computeCompatibility } from "@/lib/compatibility/engine";
import { realtime } from "@/lib/realtime/provider";
import type { Highlight } from "@/lib/compatibility/types";
import type { LikeKind } from "@/generated/prisma/enums";

export interface LikeOutcome {
  matched: boolean;
  matchId?: string;
  conversationId?: string;
  otherName?: string;
  /** Highlights between the two, so the client can show them in the match moment. */
  sharedHighlights?: Highlight[];
}

/** Why a pair matched — captured at match time. */
async function matchContext(
  aId: string,
  bId: string,
): Promise<{ headline: string | null; tags: string[]; highlights: Highlight[] }> {
  try {
    const [a, b] = await Promise.all([loadCompatInput(aId), loadCompatInput(bId)]);
    if (!a || !b) return { headline: null, tags: [], highlights: [] };
    const r = computeCompatibility(a, b);
    return {
      headline: r.highlights[0]?.text ?? null,
      tags: [...new Set(r.highlights.map((h) => h.kind))],
      highlights: r.highlights,
    };
  } catch {
    return { headline: null, tags: [], highlights: [] };
  }
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
    // Deliberately NOT `fromUserId`. Liking someone is not consent to be named
    // to them: identity is revealed when both sides have opted in, which is the
    // whole point of the mutual-match model. Naming likers here would also
    // route around `incognito` and `LIMITED` visibility — you would like
    // someone and have your name pushed to them anyway — and would turn the
    // notification list into a "who likes me" feed.
    // The comment stays: those are words the sender chose to send this person.
    await notify(targetId, "NEW_LIKE", { comment: comment ?? undefined });
    return { matched: false };
  }

  const [userAId, userBId] = orderedPair(actorId, targetId);
  const ctx = await matchContext(userAId, userBId);

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
        contextHeadline: ctx.headline,
        contextTags: ctx.tags,
        conversation: { create: {} },
      },
      select: { id: true, conversation: { select: { id: true } } },
    });
    await tx.message.create({
      data: {
        conversationId: created.conversation!.id,
        systemType: "MATCH_CREATED",
        body: ctx.headline
          ? `You connected — ${lowerFirst(ctx.headline)}.`
          : "You connected on Lunova. Say something real.",
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

  // The other person may be looking at the app right now — nudge their client.
  if (match.conversation?.id) {
    await realtime
      .publish(targetId, {
        type: "match",
        matchId: match.id,
        conversationId: match.conversation.id,
        withUserId: actorId,
      })
      .catch(() => {});
  }

  return {
    matched: true,
    matchId: match.id,
    conversationId: match.conversation?.id,
    otherName: targetProfile?.displayName ?? actorProfile?.displayName ?? "someone",
    sharedHighlights: ctx.highlights,
  };
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
