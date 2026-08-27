"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { rateLimiter, RATE_RULES } from "@/lib/rate-limit";
import { moderateText } from "@/lib/moderation/provider";
import { recordLikeAndMaybeMatch, type LikeOutcome } from "@/lib/matching/service";

const likeInput = z.object({
  targetUserId: z.string().min(1),
  comment: z.string().trim().max(300).optional(),
  elementRef: z
    .string()
    .regex(/^(photo|prompt|artist|activity|interest):[\w-]+$/)
    .optional(),
});

export type DiscoveryActionResult =
  | { ok: true; outcome: LikeOutcome }
  | { ok: false; error: string };

async function assertInteractable(viewerId: string, targetUserId: string) {
  if (targetUserId === viewerId) return "You can't do that to your own profile.";
  const blocked = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: viewerId },
      ],
    },
    select: { id: true },
  });
  if (blocked) return "This profile isn't available.";
  const target = await db.user.findFirst({
    where: { id: targetUserId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!target) return "This profile isn't available.";
  return null;
}

export async function likeAction(
  raw: z.input<typeof likeInput>,
): Promise<DiscoveryActionResult> {
  const user = await requireOnboardedUser();
  const parsed = likeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { targetUserId, comment, elementRef } = parsed.data;

  const limit = await rateLimiter.check(`likes:${user.id}`, RATE_RULES.likes);
  if (!limit.ok) {
    return { ok: false, error: "You've been very active today — take a breather." };
  }

  const problem = await assertInteractable(user.id, targetUserId);
  if (problem) return { ok: false, error: problem };

  let safeComment = comment?.trim() || undefined;
  if (safeComment) {
    const verdict = await moderateText(safeComment, "message");
    if (verdict.action === "reject") {
      return { ok: false, error: "That comment can't be sent." };
    }
    if (verdict.action === "review") safeComment = undefined; // drop, still allow the like
  }

  const outcome = await recordLikeAndMaybeMatch({
    actorId: user.id,
    targetId: targetUserId,
    kind: "LIKE",
    comment: safeComment ?? null,
    elementRef: elementRef ?? null,
  });

  // Note: the client deck advances through its own in-memory batch, so we do NOT
  // revalidate /discover here (that would shrink the list mid-swipe and skip a
  // card). The feed refreshes on the next navigation or the "Refresh" button.
  if (outcome.matched) revalidatePath("/connections");
  return { ok: true, outcome };
}

export async function passAction(
  targetUserId: string,
): Promise<DiscoveryActionResult> {
  const user = await requireOnboardedUser();
  if (!targetUserId) return { ok: false, error: "Invalid request." };

  const problem = await assertInteractable(user.id, targetUserId);
  if (problem) return { ok: false, error: problem };

  const outcome = await recordLikeAndMaybeMatch({
    actorId: user.id,
    targetId: targetUserId,
    kind: "PASS",
  });
  return { ok: true, outcome };
}
