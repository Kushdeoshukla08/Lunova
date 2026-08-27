import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/providers/storage";
import { isBlockedEitherWay } from "@/lib/safety/service";
import { ageFromBirthdate } from "@/lib/compatibility/geo";

export interface PublicProfile {
  userId: string;
  name: string;
  age: number;
  pronouns: string | null;
  bio: string | null;
  city: string | null;
  intent: string | null;
  verified: { photo: boolean; identity: boolean };
  photos: { id: string; url: string }[];
  prompts: { id: string; question: string; answer: string }[];
  interests: string[];
  music: { mood: string | null; genres: string[]; artists: string[] } | null;
  activity: { lifestyle: string | null; activities: string[]; activeDays: number | null } | null;
  connected: boolean;
}

/**
 * Read a member's profile as `viewerId` sees it. Enforces blocks and the
 * subject's per-section visibility (PUBLIC always; CONNECTIONS only if matched).
 */
export async function getPublicProfile(
  viewerId: string,
  targetId: string,
): Promise<PublicProfile | null> {
  if (viewerId === targetId) return null;
  if (await isBlockedEitherWay(viewerId, targetId)) return null;

  const connected = Boolean(
    await db.match.findFirst({
      where: {
        closedAt: null,
        OR: [
          { userAId: viewerId, userBId: targetId },
          { userAId: targetId, userBId: viewerId },
        ],
      },
      select: { id: true },
    }),
  );

  const u = await db.user.findFirst({
    where: { id: targetId, status: "ACTIVE" },
    select: {
      birthdate: true,
      trust: { select: { photoVerified: true, identityVerified: true } },
      privacy: { select: { profileVisibility: true } },
      profile: {
        select: {
          displayName: true,
          pronouns: true,
          bio: true,
          city: true,
          relationshipIntent: true,
          onboardingStep: true,
          photos: {
            where: { moderationStatus: "APPROVED" },
            orderBy: { position: "asc" },
            select: { id: true, storageKey: true },
          },
          prompts: {
            orderBy: { position: "asc" },
            select: { id: true, answer: true, question: { select: { text: true } } },
          },
          interests: { select: { interest: { select: { label: true } } } },
          music: {
            select: {
              listeningMood: true,
              topGenres: true,
              visibility: true,
              artists: { orderBy: { rank: "asc" }, select: { artist: { select: { name: true } } } },
            },
          },
          activity: {
            select: {
              preferredLifestyle: true,
              activeDaysPerWeek: true,
              visibility: true,
              types: { select: { activityType: { select: { label: true } } } },
            },
          },
        },
      },
    },
  });
  if (!u || !u.profile || u.profile.onboardingStep) return null;
  if (u.privacy?.profileVisibility === "PAUSED" && !connected) return null;

  const p = u.profile;
  const canSee = (v?: string) => v === "PUBLIC" || (v === "CONNECTIONS" && connected);

  return {
    userId: targetId,
    name: p.displayName,
    age: ageFromBirthdate(u.birthdate),
    pronouns: p.pronouns,
    bio: p.bio,
    city: p.city,
    intent: p.relationshipIntent,
    verified: {
      photo: u.trust?.photoVerified ?? false,
      identity: u.trust?.identityVerified ?? false,
    },
    photos: p.photos.map((ph) => ({ id: ph.id, url: storage.publicUrl(ph.storageKey) })),
    prompts: p.prompts.map((pr) => ({ id: pr.id, question: pr.question.text, answer: pr.answer })),
    interests: p.interests.map((i) => i.interest.label),
    music: canSee(p.music?.visibility)
      ? {
          mood: p.music!.listeningMood,
          genres: p.music!.topGenres,
          artists: p.music!.artists.map((a) => a.artist.name),
        }
      : null,
    activity: canSee(p.activity?.visibility)
      ? {
          lifestyle: p.activity!.preferredLifestyle,
          activities: p.activity!.types.map((t) => t.activityType.label),
          activeDays: p.activity!.activeDaysPerWeek,
        }
      : null,
    connected,
  };
}
