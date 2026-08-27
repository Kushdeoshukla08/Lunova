/**
 * Integration check for the onboarding data layer — runs the real Zod schemas
 * and Prisma writes against the dev database, then cleans up. Not a permanent
 * test (needs a live DB); use it to sanity-check schema/query wiring.
 *
 *   tsx scripts/verify-onboarding.ts
 */
import "dotenv/config";
import assert from "node:assert/strict";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  basicsSchema,
  interestsSchema,
  musicSchema,
  activitySchema,
  preferencesSchema,
  privacySchema,
  locationSchema,
} from "../src/lib/validation/onboarding";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const EMAIL = `verify-${Date.now()}@demo.lunova.local`;

async function main() {
  const user = await db.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword("verify-pass-123"),
      birthdate: new Date(1996, 0, 1),
      emailVerifiedAt: new Date(),
      status: "PENDING",
      preference: { create: {} },
      privacy: { create: {} },
      trust: { create: { emailVerified: true } },
      notificationPref: { create: {} },
      profile: {
        create: { displayName: "", gender: "PREFER_NOT_TO_SAY", onboardingStep: "photos" },
      },
    },
    include: { profile: true },
  });
  const profileId = user.profile!.id;

  // basics
  const basics = basicsSchema.parse({
    displayName: "Verify Bot",
    gender: "NONBINARY",
    pronouns: "they/them",
    orientation: "QUEER",
    bio: "Automated onboarding integration check — safe to delete.",
    heightCm: "175",
  });
  await db.profile.update({
    where: { id: profileId },
    data: {
      displayName: basics.displayName,
      gender: basics.gender,
      pronouns: basics.pronouns || null,
      orientation: basics.orientation || null,
      bio: basics.bio || null,
      heightCm: basics.heightCm ?? null,
    },
  });

  // location
  const loc = locationSchema.parse({ city: "Berlin", locationPrecision: "CITY" });
  await db.profile.update({
    where: { id: profileId },
    data: { city: loc.city, locationPrecision: loc.locationPrecision },
  });

  // interests
  const someInterests = (await db.interest.findMany({ take: 5, select: { slug: true } })).map(
    (i) => i.slug,
  );
  interestsSchema.parse({ interests: someInterests });
  const interestRows = await db.interest.findMany({
    where: { slug: { in: someInterests } },
    select: { id: true },
  });
  await db.profileInterest.createMany({
    data: interestRows.map((i) => ({ profileId, interestId: i.id })),
  });

  // music
  const music = musicSchema.parse({
    listeningMood: "late-night trains",
    topGenres: ["Indie", "Electronic"],
    artists: ["Test Artist A", "Test Artist B"],
  });
  const mp = await db.musicProfile.create({
    data: { profileId, listeningMood: music.listeningMood || null, topGenres: music.topGenres, provider: "internal" },
  });
  for (const [rank, name] of music.artists.entries()) {
    const artist = await db.musicArtist.upsert({ where: { name }, update: {}, create: { name } });
    await db.musicProfileArtist.create({
      data: { musicProfileId: mp.id, artistId: artist.id, rank },
    });
  }

  // activity
  const act = activitySchema.parse({
    preferredLifestyle: "weeknight runs",
    activeDaysPerWeek: "4",
    activityTypes: (await db.activityType.findMany({ take: 3, select: { slug: true } })).map(
      (t) => t.slug,
    ),
  });
  const ap = await db.activityProfile.create({
    data: {
      profileId,
      preferredLifestyle: act.preferredLifestyle || null,
      activeDaysPerWeek: act.activeDaysPerWeek ?? null,
    },
  });
  const actRows = await db.activityType.findMany({
    where: { slug: { in: act.activityTypes } },
    select: { id: true },
  });
  await db.activityProfileType.createMany({
    data: actRows.map((t) => ({ activityProfileId: ap.id, activityTypeId: t.id })),
  });

  // preferences + privacy
  const pref = preferencesSchema.parse({
    minAge: "26",
    maxAge: "38",
    maxDistanceKm: "40",
    genders: ["WOMAN", "NONBINARY"],
    globalMode: false,
  });
  await db.preference.update({ where: { userId: user.id }, data: { ...pref } });

  const priv = privacySchema.parse({
    musicVisibility: "CONNECTIONS",
    activityVisibility: "PRIVATE",
    showActiveStatus: false,
    incognito: true,
  });
  await db.privacySetting.update({ where: { userId: user.id }, data: { ...priv } });

  // finish
  await db.$transaction([
    db.profile.update({ where: { id: profileId }, data: { onboardingStep: null } }),
    db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } }),
  ]);

  // assertions
  const final = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      profile: {
        include: {
          interests: true,
          music: { include: { artists: true } },
          activity: { include: { types: true } },
        },
      },
      preference: true,
      privacy: true,
    },
  });

  assert.equal(final.status, "ACTIVE");
  assert.equal(final.profile!.onboardingStep, null);
  assert.equal(final.profile!.displayName, "Verify Bot");
  assert.equal(final.profile!.city, "Berlin");
  assert.equal(final.profile!.interests.length, 5);
  assert.equal(final.profile!.music!.artists.length, 2);
  assert.equal(final.profile!.activity!.types.length, 3);
  assert.equal(final.preference!.minAge, 26);
  assert.deepEqual(final.preference!.genders.sort(), ["NONBINARY", "WOMAN"]);
  assert.equal(final.privacy!.incognito, true);
  assert.equal(final.privacy!.activityVisibility, "PRIVATE");

  console.log("✓ onboarding data layer: all 10 assertions passed");

  // cleanup
  await db.user.delete({ where: { id: user.id } });
  console.log("✓ cleaned up throwaway user");
}

main()
  .catch((e) => {
    console.error("✗ verification failed\n", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
