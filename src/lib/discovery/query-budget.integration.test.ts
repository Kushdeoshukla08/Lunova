/**
 * DB integration — a query budget for the read paths that run on every page.
 *
 * N+1s do not announce themselves: the feature works, the page is just slower
 * with every extra profile, and nobody notices until production. These budgets
 * are deliberately a little loose — they are a tripwire for "this became linear
 * in the number of candidates", not a micro-benchmark. Raising one should be a
 * conscious decision with a reason, not a reflex to get CI green.
 *
 * Skipped unless RUN_DB_TESTS=1 (needs Postgres on :5433).
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/discovery/query-budget
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

// The media route resolves identity through the DAL; pin it to the viewer so
// the measurement covers the authorization path an ordinary member takes.
let mediaViewerId: string | null = null;
vi.mock("@/lib/auth/dal", () => ({
  getCurrentUser: async () => (mediaViewerId ? { id: mediaViewerId } : null),
}));

/** Count every statement the app's pool actually issues. */
let queries = 0;
const originalQuery = pg.Pool.prototype.query;
beforeAll(() => {
  vi.spyOn(pg.Pool.prototype, "query").mockImplementation(function (
    this: pg.Pool,
    ...args: Parameters<typeof originalQuery>
  ) {
    queries++;
    return originalQuery.apply(this, args);
  } as typeof originalQuery);
});
afterAll(() => vi.restoreAllMocks());

async function count<T>(fn: () => Promise<T>): Promise<{ result: T; queries: number }> {
  queries = 0;
  const result = await fn();
  return { result, queries };
}

d("query budget (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let getDiscoveryFeed: typeof import("./service").getDiscoveryFeed;

  const tag = `budget-${Date.now()}`;
  const ids: string[] = [];
  let viewer = "";

  async function member(name: string) {
    const interests = await db.interest.findMany({ take: 5, select: { id: true } });
    const acts = await db.activityType.findMany({ take: 3, select: { id: true } });
    const u = await db.user.create({
      data: {
        email: `${tag}-${name}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(new Date().getFullYear() - 30, 0, 1),
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        lastActiveAt: new Date(),
        preference: {
          create: { minAge: 18, maxAge: 99, maxDistanceKm: 500, genders: [], globalMode: true },
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
            city: "Lisbon",
            latitude: 38.72,
            longitude: -9.13,
            locationPrecision: "CITY",
            photos: {
              create: [0, 1, 2].map((i) => ({
                storageKey: `photos/${tag}/${name}-${i}.png`,
                moderationStatus: "APPROVED" as const,
                position: i,
                isPrimary: i === 0,
              })),
            },
            interests: { create: interests.map((i) => ({ interestId: i.id })) },
            activity: {
              create: {
                preferredLifestyle: "long walks",
                activeDaysPerWeek: 4,
                types: { create: acts.map((a) => ({ activityTypeId: a.id })) },
              },
            },
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
    viewer = await member("viewer");
    mediaViewerId = viewer;
    // Enough candidates that a per-candidate query would be unmistakable.
    for (let i = 0; i < 12; i++) await member(`cand${i}`);
    // Warm the pool and any lazily-prepared statements before measuring.
    await getDiscoveryFeed(viewer, { limit: 15 });
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.like.deleteMany({
      where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("builds the whole feed within its query budget", async () => {
    const { result, queries: n } = await count(() => getDiscoveryFeed(viewer, { limit: 15 }));
    expect(result.length).toBeGreaterThanOrEqual(10);
    // Prisma issues one statement per relation level rather than a join, so the
    // viewer load, the four exclusion lists and the candidate batch's nested
    // selects add up. The number is bounded by the *shape* of the query, not by
    // how many people are in the feed — the next test is what proves that.
    // Budget headroom, not a target: if this trips, something new is being
    // loaded per page, and that deserves a look before the number moves.
    expect(n).toBeLessThanOrEqual(40);
  });

  it("does not issue more queries as the feed grows", async () => {
    // The decisive assertion: 3 candidates and 12 candidates must cost the same.
    const small = await count(() => getDiscoveryFeed(viewer, { limit: 3 }));
    const large = await count(() => getDiscoveryFeed(viewer, { limit: 15 }));
    expect(large.result.length).toBeGreaterThan(small.result.length);
    expect(large.queries).toBe(small.queries);
  });

  it("authorizes a media request cheaply — a card fires it once per photo", async () => {
    // 15 profiles × up to 6 photos is 90 of these per feed, so the cost of one
    // is multiplied hard. Measured through the route handler, not a hand-copied
    // query, so a change to the real authorization shows up here.
    const { GET } = await import("@/app/media/[...key]/route");
    const key = `photos/${tag}/cand0-0.png`;

    const { queries: n } = await count(() =>
      GET(new Request(`http://localhost/media/${key}`), {
        params: Promise.resolve({ key: key.split("/") }),
      } as never),
    );
    // A key lookup plus one visibility check. Nesting the block check under
    // profile→user made this five, because Prisma walks relations level by level.
    expect(n).toBeLessThanOrEqual(3);
  });
});
