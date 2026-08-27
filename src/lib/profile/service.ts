import "server-only";
import { db } from "@/lib/db";
import { FIRST_STEP } from "@/lib/onboarding/steps";

/** Create the Profile row on first onboarding visit. Idempotent. */
export async function ensureProfile(userId: string) {
  const existing = await db.profile.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.profile.create({
    data: {
      userId,
      displayName: "",
      gender: "PREFER_NOT_TO_SAY",
      onboardingStep: FIRST_STEP,
    },
  });
}

export type ProfileForCompleteness = {
  displayName: string | null;
  bio: string | null;
  city: string | null;
  relationshipIntent: string | null;
  _count: {
    photos: number;
    interests: number;
    prompts: number;
  };
  music: { topGenres: string[] } | null;
  activity: { types: unknown[] } | null;
};

/**
 * 0–100 profile completeness. Weighted toward the things that make discovery
 * work: photos, a prompt or two, interests, music and movement signal.
 */
export function computeCompleteness(p: ProfileForCompleteness): number {
  let score = 0;
  if (p.displayName && p.displayName.trim().length > 0) score += 8;
  if (p._count.photos >= 1) score += 20;
  if (p._count.photos >= 3) score += 10;
  if (p.bio && p.bio.trim().length >= 20) score += 8;
  if (p._count.prompts >= 1) score += 10;
  if (p._count.prompts >= 3) score += 6;
  if (p.relationshipIntent) score += 8;
  if (p.city) score += 6;
  if (p._count.interests >= 5) score += 10;
  if ((p.music?.topGenres.length ?? 0) > 0) score += 7;
  if ((p.activity?.types.length ?? 0) > 0) score += 7;
  return Math.min(100, score);
}

export async function recomputeCompleteness(userId: string): Promise<number> {
  const p = await db.profile.findUnique({
    where: { userId },
    select: {
      displayName: true,
      bio: true,
      city: true,
      relationshipIntent: true,
      music: { select: { topGenres: true } },
      activity: { select: { types: { select: { activityTypeId: true } } } },
      _count: { select: { photos: true, interests: true, prompts: true } },
    },
  });
  if (!p) return 0;
  const value = computeCompleteness(p as ProfileForCompleteness);
  await db.profile.update({ where: { userId }, data: { completeness: value } });
  return value;
}
