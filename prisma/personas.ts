/**
 * Shared persona builder for demo / staging data. Given a `Persona` spec it
 * creates a fully-formed member: profile, two generated gradient photos,
 * prompts, interests, a music identity and a movement identity.
 *
 * NEVER call this against a production database — the guard lives in the
 * callers (`seed.ts` needs SEED_DEMO, `seed-staging.ts` needs APP_ENV=staging).
 */
import { join, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { PrismaClient } from "../src/generated/prisma/client";
import { gradientPng } from "./demo-photo";

export type Persona = {
  email: string;
  name: string;
  gender: string;
  pronouns?: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  age: number;
  intent: string;
  bio: string;
  gradient: [[number, number, number], [number, number, number]];
  prompts: Array<[string, string]>;
  interests: string[];
  genres: string[];
  artists: string[];
  mood: string;
  /** Empty array is valid — a low-activity persona must still feel represented. */
  activities: string[];
  lifestyle: string;
  activeDaysPerWeek?: number;
  /** Optional per-persona discovery preference overrides. */
  pref?: { minAge?: number; maxAge?: number; maxDistanceKm?: number; genders?: string[]; globalMode?: boolean };
};

export interface PersonaRefs {
  questions: { id: string; slug: string }[];
  interests: { id: string; slug: string; label: string }[];
  activities: { id: string; slug: string }[];
}

export async function loadPersonaRefs(prisma: PrismaClient): Promise<PersonaRefs> {
  const [questions, interests, activities] = await Promise.all([
    prisma.promptQuestion.findMany({ select: { id: true, slug: true } }),
    prisma.interest.findMany({ select: { id: true, slug: true, label: true } }),
    prisma.activityType.findMany({ select: { id: true, slug: true } }),
  ]);
  return { questions, interests, activities };
}

export async function createPersona(
  prisma: PrismaClient,
  p: Persona,
  opts: {
    passwordHash: string;
    uploadRoot: string;
    refs: PersonaRefs;
    lastActiveOffsetMs?: number;
  },
): Promise<string | null> {
  const { refs } = opts;
  if (await prisma.user.findUnique({ where: { email: p.email }, select: { id: true } })) {
    return null; // idempotent
  }

  const findQuestion = (frag: string) =>
    refs.questions.find((q) => q.slug.includes(frag)) ?? refs.questions[0];
  const findInterest = (frag: string) =>
    refs.interests.find(
      (i) => i.slug.includes(frag) || i.label.toLowerCase().includes(frag),
    );
  const findActivity = (slug: string) => refs.activities.find((a) => a.slug === slug);

  const birthdate = new Date(new Date().getFullYear() - p.age, 5, 15);

  const user = await prisma.user.create({
    data: {
      email: p.email,
      passwordHash: opts.passwordHash,
      birthdate,
      emailVerifiedAt: new Date(),
      ageVerifiedAt: new Date(),
      status: "ACTIVE",
      lastActiveAt: new Date(Date.now() - (opts.lastActiveOffsetMs ?? 0)),
      profile: {
        create: {
          displayName: p.name,
          gender: p.gender as never,
          pronouns: p.pronouns ?? (p.gender === "NONBINARY" ? "they/them" : undefined),
          city: p.city,
          country: p.country,
          latitude: p.lat,
          longitude: p.lng,
          locationPrecision: "CITY",
          relationshipIntent: p.intent as never,
          bio: p.bio,
          onboardingStep: null,
          completeness: 90,
        },
      },
      preference: {
        create: {
          // Wide by default so any plausible adult test account with default
          // preferences can discover several personas. Individual personas
          // narrow this via `p.pref` where their character calls for it.
          minAge: p.pref?.minAge ?? 21,
          maxAge: p.pref?.maxAge ?? 55,
          maxDistanceKm: p.pref?.maxDistanceKm ?? 200,
          genders: (p.pref?.genders ?? []) as never,
          globalMode: p.pref?.globalMode ?? false,
        },
      },
      privacy: { create: {} },
      trust: { create: { emailVerified: true, phoneVerified: true, photoVerified: true } },
      notificationPref: { create: {} },
    },
    select: { id: true, profile: { select: { id: true } } },
  });
  const profileId = user.profile!.id;

  for (const { key, bytes, position, isPrimary } of personaPhotos(p)) {
    const abs = join(opts.uploadRoot, key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, bytes);
    await prisma.photo.create({
      data: {
        profileId,
        storageKey: key,
        position,
        isPrimary,
        width: PERSONA_PHOTO_WIDTH,
        height: PERSONA_PHOTO_HEIGHT,
        moderationStatus: "APPROVED",
      },
    });
  }

  for (const [frag, answer] of p.prompts) {
    const q = findQuestion(frag);
    await prisma.profilePrompt.upsert({
      where: { profileId_questionId: { profileId, questionId: q.id } },
      update: { answer },
      create: { profileId, questionId: q.id, answer },
    });
  }

  const interestIds = p.interests
    .map((frag) => findInterest(frag)?.id)
    .filter((x): x is string => Boolean(x));
  await prisma.profileInterest.createMany({
    data: interestIds.map((interestId) => ({ profileId, interestId })),
    skipDuplicates: true,
  });

  const music = await prisma.musicProfile.create({
    data: {
      profileId,
      provider: "internal",
      listeningMood: p.mood,
      topGenres: p.genres,
      visibility: "PUBLIC",
    },
  });
  for (const [rank, name] of p.artists.entries()) {
    const artist = await prisma.musicArtist.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.musicProfileArtist.create({
      data: { musicProfileId: music.id, artistId: artist.id, rank },
    });
  }

  // A persona with no activities still gets an ActivityProfile (the lifestyle
  // line + visibility) — being a low-activity person is an identity, not a gap.
  const activity = await prisma.activityProfile.create({
    data: {
      profileId,
      preferredLifestyle: p.lifestyle,
      activeDaysPerWeek: p.activeDaysPerWeek ?? (p.activities.length ? 4 : 1),
      visibility: "PUBLIC",
    },
  });
  const activityIds = p.activities
    .map((s) => findActivity(s)?.id)
    .filter((x): x is string => Boolean(x));
  if (activityIds.length) {
    await prisma.activityProfileType.createMany({
      data: activityIds.map((activityTypeId) => ({
        activityProfileId: activity.id,
        activityTypeId,
      })),
      skipDuplicates: true,
    });
  }

  return user.id;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const PERSONA_PHOTO_WIDTH = 600;
export const PERSONA_PHOTO_HEIGHT = 750;

/**
 * A persona's photos — key and bytes together, derived only from the persona.
 *
 * Both the seeder (which writes them next to the database rows) and the Docker
 * build (which bakes them into the image, because the container's disk is wiped
 * on every deploy) go through this. Two copies of the key formula would drift,
 * and the failure mode is silent: rows pointing at files that are not there.
 */
export function personaPhotos(
  p: Pick<Persona, "name" | "gradient">,
): { key: string; bytes: Buffer; position: number; isPrimary: boolean }[] {
  return [0, 1].map((i) => {
    const [top, bottom] = i === 0 ? p.gradient : [p.gradient[1], p.gradient[0]];
    return {
      key: `photos/persona/${slug(p.name)}-${i}.png`,
      bytes: gradientPng(PERSONA_PHOTO_WIDTH, PERSONA_PHOTO_HEIGHT, top, bottom),
      position: i,
      isPrimary: i === 0,
    };
  });
}
