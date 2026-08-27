/**
 * DB integration — exercises the real discovery query + matching transaction
 * against the dev database. Skipped unless RUN_DB_TESTS=1 (needs Postgres on :5433).
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/discovery
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("discovery + matching (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let getDiscoveryFeed: typeof import("./service").getDiscoveryFeed;
  let recordLikeAndMaybeMatch: typeof import("@/lib/matching/service").recordLikeAndMaybeMatch;
  const ids: string[] = [];
  const tag = `disc-${Date.now()}`;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getDiscoveryFeed } = await import("./service"));
    ({ recordLikeAndMaybeMatch } = await import("@/lib/matching/service"));

    const interests = await db.interest.findMany({ take: 5, select: { id: true, slug: true } });
    const acts = await db.activityType.findMany({ take: 3, select: { id: true, slug: true } });
    const question = await db.promptQuestion.findFirst({ select: { id: true } });

    async function makeUser(name: string, extra: { lat: number; lng: number }) {
      const u = await db.user.create({
        data: {
          email: `${tag}-${name}@demo.lunova.local`,
          passwordHash: "x",
          birthdate: new Date(1996, 0, 1),
          emailVerifiedAt: new Date(),
          status: "ACTIVE",
          preference: {
            create: { minAge: 25, maxAge: 45, maxDistanceKm: 60, genders: [], globalMode: false },
          },
          privacy: { create: {} },
          trust: { create: {} },
          notificationPref: { create: {} },
          profile: {
            create: {
              displayName: name,
              gender: "NONBINARY",
              onboardingStep: null,
              relationshipIntent: "LONG_TERM",
              latitude: extra.lat,
              longitude: extra.lng,
              locationPrecision: "CITY",
              photos: {
                create: { storageKey: `photos/x/y/${name}.jpg`, moderationStatus: "APPROVED", position: 0, isPrimary: true },
              },
              prompts: question
                ? { create: { questionId: question.id, answer: "Tide pools before the crowds." } }
                : undefined,
              interests: { create: interests.map((i) => ({ interestId: i.id })) },
              music: {
                create: {
                  provider: "internal",
                  topGenres: ["Indie", "Folk"],
                  visibility: "PUBLIC",
                },
              },
              activity: {
                create: {
                  visibility: "PUBLIC",
                  types: { create: acts.map((a) => ({ activityTypeId: a.id })) },
                },
              },
            },
          },
        },
        select: { id: true, profile: { select: { id: true, music: { select: { id: true } } } } },
      });
      ids.push(u.id);
      // shared artist
      const artist = await db.musicArtist.upsert({
        where: { name: `${tag} Shared Band` },
        update: {},
        create: { name: `${tag} Shared Band` },
      });
      await db.musicProfileArtist.create({
        data: { musicProfileId: u.profile!.music!.id, artistId: artist.id, rank: 0 },
      });
      return u.id;
    }

    await makeUser("Alex", { lat: 38.72, lng: -9.14 });
    await makeUser("Sam", { lat: 38.73, lng: -9.15 }); // ~1.5 km away
  });

  afterAll(async () => {
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.musicArtist.deleteMany({ where: { name: `${tag} Shared Band` } });
  });

  it("feed returns the compatible candidate with highlights, not the viewer", async () => {
    const feed = await getDiscoveryFeed(ids[0], { limit: 10 });
    const sam = feed.find((p) => p.userId === ids[1]);
    expect(sam).toBeTruthy();
    expect(feed.some((p) => p.userId === ids[0])).toBe(false);
    expect(sam!.compatibility.highlights.length).toBeGreaterThan(0);
    expect(sam!.music?.artists).toContain(`${tag} Shared Band`);
    expect(sam!.distanceText).toBeTruthy();
  });

  it("a one-way like does not create a match", async () => {
    const out = await recordLikeAndMaybeMatch({
      actorId: ids[0],
      targetId: ids[1],
      kind: "LIKE",
    });
    expect(out.matched).toBe(false);
    const matches = await db.match.count({
      where: { OR: [{ userAId: ids[0] }, { userBId: ids[0] }] },
    });
    expect(matches).toBe(0);
  });

  it("the reciprocal like creates a Match + Conversation + system message", async () => {
    const out = await recordLikeAndMaybeMatch({
      actorId: ids[1],
      targetId: ids[0],
      kind: "LIKE",
    });
    expect(out.matched).toBe(true);
    expect(out.conversationId).toBeTruthy();

    const convo = await db.conversation.findUnique({
      where: { id: out.conversationId! },
      select: { messages: { select: { systemType: true } } },
    });
    expect(convo!.messages[0].systemType).toBe("MATCH_CREATED");

    const notes = await db.notification.count({
      where: { userId: { in: ids }, type: "NEW_MATCH" },
    });
    expect(notes).toBe(2);
  });

  it("after acting on someone they no longer appear in the feed", async () => {
    const feed = await getDiscoveryFeed(ids[0], { limit: 10 });
    expect(feed.some((p) => p.userId === ids[1])).toBe(false);
  });
});
