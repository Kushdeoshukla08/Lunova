/**
 * DB integration: changing Discovery preferences (age band / distance / worldwide
 * / genders) changes which candidates the feed returns. RUN_DB_TESTS=1.
 *
 * This is the guard that a *persisted* preference actually reaches the query —
 * pairs with preferences.integration.test.ts (which proves the save persists).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("discovery preference filtering (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let getDiscoveryFeed: typeof import("./service").getDiscoveryFeed;
  const ids: string[] = [];
  const tag = `pf-${Date.now()}`;
  let viewerId = "";
  let candidateId = "";

  const yearsAgo = (n: number) => new Date(new Date().getFullYear() - n, 5, 15);

  async function makeUser(
    name: string,
    opts: {
      age: number;
      gender: "WOMAN" | "MAN" | "NONBINARY";
      lat: number;
      lng: number;
      pref: { minAge: number; maxAge: number; maxDistanceKm: number; genders?: string[]; globalMode?: boolean };
    },
  ) {
    const interests = await db.interest.findMany({ take: 4, select: { id: true } });
    const u = await db.user.create({
      data: {
        email: `${tag}-${name}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: yearsAgo(opts.age),
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        preference: {
          create: {
            minAge: opts.pref.minAge,
            maxAge: opts.pref.maxAge,
            maxDistanceKm: opts.pref.maxDistanceKm,
            genders: (opts.pref.genders ?? []) as never,
            globalMode: opts.pref.globalMode ?? false,
          },
        },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: {
            displayName: name,
            gender: opts.gender,
            onboardingStep: null,
            relationshipIntent: "LONG_TERM",
            latitude: opts.lat,
            longitude: opts.lng,
            locationPrecision: "CITY",
            photos: {
              create: { storageKey: `photos/x/y/${name}.jpg`, moderationStatus: "APPROVED", position: 0, isPrimary: true },
            },
            interests: { create: interests.map((i) => ({ interestId: i.id })) },
          },
        },
      },
      select: { id: true },
    });
    ids.push(u.id);
    return u.id;
  }

  async function setViewerPref(p: Partial<{ minAge: number; maxAge: number; maxDistanceKm: number; genders: string[]; globalMode: boolean }>) {
    await db.preference.update({ where: { userId: viewerId }, data: p as never });
  }

  const candidateInFeed = async () => {
    const feed = await getDiscoveryFeed(viewerId, { limit: 25 });
    return feed.some((p) => p.userId === candidateId);
  };

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getDiscoveryFeed } = await import("./service"));

    // Viewer: 30, in Lisbon, wide prefs to start.
    viewerId = await makeUser("viewer", {
      age: 30,
      gender: "WOMAN",
      lat: 38.722,
      lng: -9.139,
      pref: { minAge: 18, maxAge: 99, maxDistanceKm: 500 },
    });
    // Candidate: 41, MAN, ~2.2 km away. Accepts 18–99 by age, but keeps its own
    // distance tight (the feed's distance gate uses the *more permissive* of the
    // two people's `maxDistanceKm`, so the candidate can't be wide open here).
    candidateId = await makeUser("candidate", {
      age: 41,
      gender: "MAN",
      lat: 38.74,
      lng: -9.15,
      pref: { minAge: 18, maxAge: 99, maxDistanceKm: 1, globalMode: false },
    });
  });

  afterAll(async () => {
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("baseline: wide prefs → candidate appears", async () => {
    await setViewerPref({ minAge: 18, maxAge: 99, maxDistanceKm: 500, genders: [], globalMode: false });
    expect(await candidateInFeed()).toBe(true);
  });

  it("age band that excludes the candidate → gone; widen it → back", async () => {
    await setViewerPref({ minAge: 25, maxAge: 35 }); // candidate is 41
    expect(await candidateInFeed()).toBe(false);

    await setViewerPref({ minAge: 25, maxAge: 50 });
    expect(await candidateInFeed()).toBe(true);
  });

  it("distance shorter than the gap → gone; enabling worldwide → back", async () => {
    await setViewerPref({ minAge: 18, maxAge: 99, maxDistanceKm: 1, globalMode: false }); // gap ~2.3 km
    expect(await candidateInFeed()).toBe(false);

    await setViewerPref({ globalMode: true });
    expect(await candidateInFeed()).toBe(true);

    await setViewerPref({ maxDistanceKm: 25, globalMode: false });
    expect(await candidateInFeed()).toBe(true);
  });

  it("genders filter that excludes the candidate → gone; clear it → back", async () => {
    await setViewerPref({ minAge: 18, maxAge: 99, maxDistanceKm: 500, genders: ["WOMAN"] }); // candidate is MAN
    expect(await candidateInFeed()).toBe(false);

    await setViewerPref({ genders: [] });
    expect(await candidateInFeed()).toBe(true);
  });
});
