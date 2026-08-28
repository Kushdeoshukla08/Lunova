import "server-only";
import { db } from "@/lib/db";
import {
  computeCompatibility,
  type WeightOverride,
} from "@/lib/compatibility/engine";
import type { CompatInput, Highlight } from "@/lib/compatibility/types";
import { exposeVariant } from "@/lib/experiments/assign";
import type { WeightConfig } from "@/lib/experiments/registry";
import { ageFromBirthdate, describeDistance } from "@/lib/compatibility/geo";

export interface DiscoveryPrompt {
  id: string;
  question: string;
  answer: string;
}

export interface DiscoveryProfile {
  userId: string;
  displayName: string;
  age: number;
  pronouns: string | null;
  bio: string | null;
  city: string | null;
  distanceText: string | null;
  photos: { id: string; url: string; blurhash: string | null }[];
  prompts: DiscoveryPrompt[];
  interests: string[];
  music: { mood: string | null; artists: string[]; genres: string[] } | null;
  activity: { lifestyle: string | null; activities: string[]; activeDays: number | null } | null;
  intentLabel: string | null;
  verified: { photo: boolean; identity: boolean };
  isNew: boolean;
  compatibility: {
    label: string;
    highlights: Highlight[];
  };
}

const BATCH = 60;

/**
 * Build the discovery feed for a viewer. Coarse filtering (status, blocks,
 * already-acted, age band, photo present, not paused/incognito) runs in SQL;
 * the compatibility engine ranks the batch in-app and applies mutual
 * preference + distance checks. Privacy controls decide what each card exposes.
 */
export async function getDiscoveryFeed(
  viewerUserId: string,
  {
    limit = 15,
    units = "metric",
  }: { limit?: number; units?: "metric" | "imperial" } = {},
): Promise<DiscoveryProfile[]> {
  const viewer = await loadViewer(viewerUserId);
  if (!viewer) return [];

  // Ranking-weight experiment (disabled by default; see docs/EXPERIMENTS.md).
  const { config: weightExp } = exposeVariant<WeightConfig>(
    "discovery_music_weight_v1",
    viewerUserId,
  );
  const weights: WeightOverride | undefined =
    Object.keys(weightExp.weights).length > 0 ? weightExp.weights : undefined;

  const [blocks, acted, likedMe] = await Promise.all([
    db.block.findMany({
      where: { OR: [{ blockerId: viewerUserId }, { blockedId: viewerUserId }] },
      select: { blockerId: true, blockedId: true },
    }),
    db.like.findMany({
      where: { actorId: viewerUserId },
      select: { targetId: true },
    }),
    // people who have liked the viewer — the only ones a LIMITED profile is shown to
    db.like.findMany({
      where: { targetId: viewerUserId, kind: "LIKE" },
      select: { actorId: true },
      take: 2000,
    }),
  ]);
  const excludeIds = new Set<string>([viewerUserId]);
  for (const b of blocks) {
    excludeIds.add(b.blockerId === viewerUserId ? b.blockedId : b.blockerId);
  }
  for (const a of acted) excludeIds.add(a.targetId);
  const likedMeIds = likedMe.map((l) => l.actorId);

  const now = new Date();
  const oldest = new Date(now);
  oldest.setFullYear(oldest.getFullYear() - viewer.pref.maxAge - 1);
  const youngest = new Date(now);
  youngest.setFullYear(youngest.getFullYear() - viewer.pref.minAge);

  const candidates = await db.user.findMany({
    where: {
      status: "ACTIVE",
      id: { notIn: [...excludeIds] },
      birthdate: { gte: oldest, lte: youngest },
      ...(viewer.pref.genders.length
        ? { profile: { gender: { in: viewer.pref.genders as never } } }
        : {}),
      privacy: {
        is: { profileVisibility: { not: "PAUSED" }, discoveryPaused: false, incognito: false },
      },
      // LIMITED profiles ("only people I've liked can find me") appear only to
      // viewers they have liked.
      OR: [
        { privacy: { is: { profileVisibility: { not: "LIMITED" } } } },
        { id: { in: likedMeIds } },
      ],
      profile: {
        is: {
          onboardingStep: null,
          photos: { some: { moderationStatus: "APPROVED" } },
        },
      },
    },
    orderBy: [{ lastActiveAt: "desc" }],
    take: BATCH,
    select: candidateSelect,
  });

  const scored = candidates
    .map((c) => {
      const input = toCompatInput(c);
      const result = computeCompatibility(viewer.compat, input, weights);
      return { c, input, result };
    })
    .filter(({ result }) => result.mutuallyEligible)
    .filter(({ result, c }) => {
      if (viewer.pref.globalMode || c.preference?.globalMode) return true;
      if (result.distanceKm == null) return true;
      return (
        result.distanceKm <=
        Math.max(viewer.pref.maxDistanceKm, c.preference?.maxDistanceKm ?? 0) + 1
      );
    })
    .sort((a, b) => {
      if (b.result.score !== a.result.score) return b.result.score - a.result.score;
      // fairness: nudge newer accounts up on ties
      return (
        (isRecent(b.c.createdAt) ? 1 : 0) - (isRecent(a.c.createdAt) ? 1 : 0)
      );
    })
    .slice(0, limit);

  return scored.map(({ c, result }) => shapeProfile(c, viewer, result, units));
}

// ─── loading ─────────────────────────────────────────────────────────────────

const candidateSelect = {
  id: true,
  createdAt: true,
  birthdate: true,
  profile: {
    select: {
      displayName: true,
      gender: true,
      pronouns: true,
      bio: true,
      city: true,
      latitude: true,
      longitude: true,
      locationPrecision: true,
      relationshipIntent: true,
      photos: {
        where: { moderationStatus: "APPROVED" },
        orderBy: { position: "asc" },
        select: { id: true, storageKey: true, blurhash: true },
        take: 6,
      },
      prompts: {
        orderBy: { position: "asc" },
        select: { id: true, answer: true, question: { select: { slug: true, text: true } } },
        take: 3,
      },
      interests: { select: { interest: { select: { slug: true, label: true } } } },
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
          types: { select: { activityType: { select: { slug: true, label: true } } } },
        },
      },
    },
  },
  preference: {
    select: {
      minAge: true,
      maxAge: true,
      maxDistanceKm: true,
      genders: true,
      globalMode: true,
    },
  },
  trust: { select: { photoVerified: true, identityVerified: true } },
} as const;

type CandidateRow = Awaited<
  ReturnType<typeof db.user.findMany<{ select: typeof candidateSelect }>>
>[number];

async function loadViewer(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      birthdate: true,
      status: true,
      profile: {
        select: {
          gender: true,
          onboardingStep: true,
          relationshipIntent: true,
          latitude: true,
          longitude: true,
          interests: { select: { interest: { select: { slug: true, label: true } } } },
          prompts: { select: { question: { select: { slug: true } } } },
          music: {
            select: {
              topGenres: true,
              artists: { select: { artist: { select: { name: true } } } },
            },
          },
          activity: {
            select: {
              preferredLifestyle: true,
              types: { select: { activityType: { select: { slug: true } } } },
            },
          },
        },
      },
      preference: {
        select: {
          minAge: true,
          maxAge: true,
          maxDistanceKm: true,
          genders: true,
          globalMode: true,
        },
      },
    },
  });
  if (!u || u.status !== "ACTIVE" || !u.profile || u.profile.onboardingStep || !u.preference) {
    return null;
  }
  const pref = u.preference;
  const compat: CompatInput = {
    userId: u.id,
    birthdate: u.birthdate,
    gender: u.profile.gender,
    relationshipIntent: u.profile.relationshipIntent,
    latitude: u.profile.latitude,
    longitude: u.profile.longitude,
    interests: u.profile.interests.map((i) => i.interest.slug),
    interestLabels: Object.fromEntries(
      u.profile.interests.map((i) => [i.interest.slug, i.interest.label]),
    ),
    music: u.profile.music
      ? {
          artists: u.profile.music.artists.map((a) => a.artist.name.toLowerCase()),
          genres: u.profile.music.topGenres.map((g) => g.toLowerCase()),
        }
      : null,
    activity: u.profile.activity
      ? {
          types: u.profile.activity.types.map((t) => t.activityType.slug),
          lifestyle: u.profile.activity.preferredLifestyle,
        }
      : null,
    answeredPrompts: u.profile.prompts.map((p) => p.question.slug),
    preference: {
      minAge: pref.minAge,
      maxAge: pref.maxAge,
      maxDistanceKm: pref.maxDistanceKm,
      genders: pref.genders,
      globalMode: pref.globalMode,
    },
  };
  return { compat, pref };
}

function toCompatInput(c: CandidateRow): CompatInput {
  const p = c.profile!;
  return {
    userId: c.id,
    birthdate: c.birthdate,
    gender: p.gender,
    relationshipIntent: p.relationshipIntent,
    latitude: p.latitude,
    longitude: p.longitude,
    interests: p.interests.map((i) => i.interest.slug),
    interestLabels: Object.fromEntries(
      p.interests.map((i) => [i.interest.slug, i.interest.label]),
    ),
    music: p.music
      ? {
          artists: p.music.artists.map((a) => a.artist.name.toLowerCase()),
          genres: p.music.topGenres.map((g) => g.toLowerCase()),
        }
      : null,
    activity: p.activity
      ? { types: p.activity.types.map((t) => t.activityType.slug), lifestyle: p.activity.preferredLifestyle }
      : null,
    answeredPrompts: p.prompts.map((pr) => pr.question.slug),
    preference: c.preference
      ? {
          minAge: c.preference.minAge,
          maxAge: c.preference.maxAge,
          maxDistanceKm: c.preference.maxDistanceKm,
          genders: c.preference.genders,
          globalMode: c.preference.globalMode,
        }
      : { minAge: 18, maxAge: 100, maxDistanceKm: 500, genders: [], globalMode: true },
  };
}

function shapeProfile(
  c: CandidateRow,
  viewer: { compat: CompatInput },
  result: ReturnType<typeof computeCompatibility>,
  units: "metric" | "imperial",
): DiscoveryProfile {
  const p = c.profile!;
  const musicVisible = p.music?.visibility === "PUBLIC";
  const activityVisible = p.activity?.visibility === "PUBLIC";

  return {
    userId: c.id,
    displayName: p.displayName,
    age: ageFromBirthdate(c.birthdate),
    pronouns: p.pronouns,
    bio: p.bio,
    city: p.city,
    distanceText: describeDistance(result.distanceKm, p.locationPrecision, units),
    photos: p.photos.map((ph) => ({
      id: ph.id,
      url: `/media/${ph.storageKey}`,
      blurhash: ph.blurhash,
    })),
    prompts: p.prompts.map((pr) => ({
      id: pr.id,
      question: pr.question.text,
      answer: pr.answer,
    })),
    interests: p.interests.map((i) => i.interest.label),
    music:
      musicVisible && p.music
        ? {
            mood: p.music.listeningMood,
            artists: p.music.artists.map((a) => a.artist.name),
            genres: p.music.topGenres,
          }
        : null,
    activity:
      activityVisible && p.activity
        ? {
            lifestyle: p.activity.preferredLifestyle,
            activities: p.activity.types.map((t) => t.activityType.label),
            activeDays: p.activity.activeDaysPerWeek,
          }
        : null,
    intentLabel: p.relationshipIntent,
    verified: {
      photo: c.trust?.photoVerified ?? false,
      identity: c.trust?.identityVerified ?? false,
    },
    isNew: isRecent(c.createdAt),
    compatibility: { label: result.label, highlights: result.highlights },
  };
}

function isRecent(d: Date): boolean {
  return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
}
