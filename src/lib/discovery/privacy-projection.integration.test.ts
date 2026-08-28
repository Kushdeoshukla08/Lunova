/**
 * DB integration — the privacy switches a member actually sees in Settings must
 * change what other members are served.
 *
 * These three were collected, stored and then ignored on every read path, which
 * is the worst kind of privacy bug: the control looks like it works.
 * Skipped unless RUN_DB_TESTS=1 (needs Postgres on :5433).
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/discovery/privacy-projection
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("privacy projection (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let getDiscoveryFeed: typeof import("./service").getDiscoveryFeed;
  let getPublicProfile: typeof import("@/lib/profile/view").getPublicProfile;

  const tag = `priv-${Date.now()}`;
  const ids: string[] = [];
  let viewer = "";
  let openBook = "";
  let guarded = "";

  /** Both candidates are 34 and 3 km from the viewer — only privacy differs. */
  async function member(
    name: string,
    privacy: { showAgeExact?: boolean; distanceVisibility?: "PUBLIC" | "CONNECTIONS" | "PRIVATE" },
  ) {
    const interests = await db.interest.findMany({ take: 4, select: { id: true } });
    const u = await db.user.create({
      data: {
        email: `${tag}-${name}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(new Date().getFullYear() - 34, 0, 1),
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        lastActiveAt: new Date(),
        preference: {
          create: { minAge: 18, maxAge: 99, maxDistanceKm: 500, genders: [], globalMode: true },
        },
        privacy: { create: privacy },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: {
            displayName: name,
            gender: "NONBINARY",
            onboardingStep: null,
            relationshipIntent: "LONG_TERM",
            city: "Lisbon",
            latitude: 38.75,
            longitude: -9.15,
            locationPrecision: "CITY",
            photos: {
              create: {
                storageKey: `photos/${tag}/${name}.png`,
                moderationStatus: "APPROVED",
                position: 0,
                isPrimary: true,
              },
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

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getDiscoveryFeed } = await import("./service"));
    ({ getPublicProfile } = await import("@/lib/profile/view"));

    viewer = await member("viewer", {});
    openBook = await member("openbook", { showAgeExact: true, distanceVisibility: "PUBLIC" });
    guarded = await member("guarded", { showAgeExact: false, distanceVisibility: "PRIVATE" });
  });

  afterAll(async () => {
    if (!db) return;
    await db.like.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  async function cardFor(userId: string) {
    const feed = await getDiscoveryFeed(viewer, { limit: 50 });
    return feed.find((p) => p.userId === userId);
  }

  it("shows exact age and distance for a member who allows both", async () => {
    const card = await cardFor(openBook);
    expect(card).toBeDefined();
    expect(card!.age).toBe(34);
    expect(card!.distanceText).toBeTruthy();
  });

  it("withholds the exact age when the member turned it off", async () => {
    const card = await cardFor(guarded);
    expect(card).toBeDefined();
    expect(card!.age).toBeNull();
    // A band is still shown so the card is not just missing information…
    expect(card!.ageBand).toBe("mid 30s");
    // …but the exact year must not be recoverable from anywhere on the card.
    expect(JSON.stringify(card)).not.toContain("34");
  });

  it("withholds distance when the member set it to private", async () => {
    const card = await cardFor(guarded);
    expect(card!.distanceText).toBeNull();
    // The city they chose to publish is a separate control and stays.
    expect(card!.city).toBe("Lisbon");
  });

  it("still ranks and filters on the real age, only the display changes", async () => {
    // A viewer whose band excludes 34 must not see them, privacy setting or not.
    await db.preference.update({ where: { userId: viewer }, data: { minAge: 18, maxAge: 25 } });
    const narrowed = await getDiscoveryFeed(viewer, { limit: 50 });
    expect(narrowed.map((p) => p.userId)).not.toContain(guarded);
    await db.preference.update({ where: { userId: viewer }, data: { minAge: 18, maxAge: 99 } });
  });

  it("applies the same age rule on the full profile page", async () => {
    const open = await getPublicProfile(viewer, openBook);
    expect(open!.age).toBe(34);

    const shy = await getPublicProfile(viewer, guarded);
    expect(shy!.age).toBeNull();
    expect(shy!.ageBand).toBe("mid 30s");
  });
});
