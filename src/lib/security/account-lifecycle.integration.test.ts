/**
 * DB integration — what a suspended, banned or deleted account can still reach,
 * and what other members can still see of it.
 *
 * These are the cases where "it works" and "it is correct" come apart quietly:
 * the account is gone from the UI, but a stale session, a saved URL or a
 * notification row still resolves. Skipped unless RUN_DB_TESTS=1.
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/security/account-lifecycle
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

// The route handler and messaging action resolve identity through the DAL,
// which needs a request scope. Pin it to the viewer so both are exercised as
// an ordinary signed-in member rather than as an anonymous caller.
let currentUserId: string | null = null;
vi.mock("@/lib/auth/dal", () => ({
  getCurrentUser: async () => (currentUserId ? { id: currentUserId } : null),
  requireUser: async () => ({ id: currentUserId }),
  requireOnboardedUser: async () => ({ id: currentUserId }),
}));

d("account lifecycle (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let getDiscoveryFeed: typeof import("@/lib/discovery/service").getDiscoveryFeed;
  let getPublicProfile: typeof import("@/lib/profile/view").getPublicProfile;
  let getConversation: typeof import("@/lib/conversations/service").getConversation;
  let getConversations: typeof import("@/lib/conversations/service").getConversations;
  let sendMessageAction: typeof import("@/lib/messaging/actions").sendMessageAction;

  const tag = `life-${Date.now()}`;
  const ids: string[] = [];
  let viewer = "";
  let leaver = "";
  let conversationId = "";

  async function member(name: string) {
    const interests = await db.interest.findMany({ take: 4, select: { id: true } });
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
    ({ getDiscoveryFeed } = await import("@/lib/discovery/service"));
    ({ getPublicProfile } = await import("@/lib/profile/view"));
    ({ getConversation, getConversations } = await import("@/lib/conversations/service"));
    ({ sendMessageAction } = await import("@/lib/messaging/actions"));

    viewer = await member("viewer");
    currentUserId = viewer;
    leaver = await member("leaver");

    const match = await db.match.create({
      data: {
        userAId: viewer,
        userBId: leaver,
        contextHeadline: "You both keep coming back to slow mornings",
        contextTags: ["interest"],
        conversation: { create: {} },
      },
      select: { conversation: { select: { id: true } } },
    });
    conversationId = match.conversation!.id;
    await db.message.create({
      data: { conversationId, senderId: leaver, body: "a thing they said before leaving" },
    });
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.match.deleteMany({
      where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("shows a live member normally, as a baseline", async () => {
    const feed = await getDiscoveryFeed(viewer, { limit: 50 });
    expect(feed.map((p) => p.userId)).toContain(leaver);
    expect(await getPublicProfile(viewer, leaver)).not.toBeNull();
  });

  describe("suspended", () => {
    beforeAll(() => db.user.update({ where: { id: leaver }, data: { status: "SUSPENDED" } }));

    it("disappears from discovery and from their profile page", async () => {
      const feed = await getDiscoveryFeed(viewer, { limit: 50 });
      expect(feed.map((p) => p.userId)).not.toContain(leaver);
      expect(await getPublicProfile(viewer, leaver)).toBeNull();
    });

    it("cannot load the feed themselves", async () => {
      // The viewer loader gates on ACTIVE, so a stale session gets an empty
      // feed rather than a working product surface.
      expect(await getDiscoveryFeed(leaver, { limit: 10 })).toEqual([]);
    });
  });

  describe("banned", () => {
    beforeAll(() => db.user.update({ where: { id: leaver }, data: { status: "BANNED" } }));

    it("stays out of discovery and their profile stays unreadable", async () => {
      const feed = await getDiscoveryFeed(viewer, { limit: 50 });
      expect(feed.map((p) => p.userId)).not.toContain(leaver);
      expect(await getPublicProfile(viewer, leaver)).toBeNull();
    });

    it("their photos are no longer served, even to a signed-in member", async () => {
      // A saved image URL outlives the ban unless the route re-checks the owner
      // on every request — which is the point of doing it there rather than
      // only filtering the feed.
      const { GET } = await import("@/app/media/[...key]/route");
      const key = `photos/${tag}/leaver.png`;
      const res = await GET(new Request(`http://localhost/media/${key}`), {
        params: Promise.resolve({ key: key.split("/") }),
      } as never);
      expect(res.status).toBe(404);
    });
  });

  describe("deleted", () => {
    beforeAll(async () => {
      // Mirror what deleteAccountAction does to the shell, without the session
      // and storage side effects a Server Action would need.
      await db.match.updateMany({
        where: { closedAt: null, OR: [{ userAId: leaver }, { userBId: leaver }] },
        data: { closedAt: new Date(), closeReason: "ACCOUNT_REMOVED" },
      });
      await db.message.updateMany({
        where: { senderId: leaver, deletedAt: null },
        data: { body: "", deletedAt: new Date() },
      });
      await db.profile.deleteMany({ where: { userId: leaver } });
      await db.user.update({
        where: { id: leaver },
        data: {
          email: `deleted+${leaver}@lunova.invalid`,
          phone: null,
          passwordHash: "",
          status: "DELETED",
          deletedAt: new Date(),
          emailVerifiedAt: null,
        },
      });
    });

    it("leaves no readable trace of what they wrote", async () => {
      const thread = await getConversation(viewer, conversationId);
      // The other party keeps the thread, but the words are gone — a tombstone,
      // not a transcript.
      const bodies = (thread?.messages ?? []).map((m) => m.body);
      expect(bodies.join(" ")).not.toContain("a thing they said before leaving");
    });

    it("closes the match rather than leaving a live conversation", async () => {
      const list = await getConversations(viewer);
      expect(list.map((c) => c.conversationId)).not.toContain(conversationId);
    });

    it("cannot be messaged", async () => {
      const res = await sendMessageAction({ conversationId, body: "still there?" }).catch(
        (e: unknown) => ({ ok: false as const, error: String(e) }),
      );
      expect(res.ok).toBe(false);
    });

    it("is not resolvable as a profile", async () => {
      expect(await getPublicProfile(viewer, leaver)).toBeNull();
    });

    it("keeps no password that could ever be verified", async () => {
      const { verifyPasswordConstantTime } = await import("@/lib/auth/password");
      const row = await db.user.findUnique({
        where: { id: leaver },
        select: { passwordHash: true, email: true },
      });
      expect(row!.email).not.toContain("@demo.lunova.local");
      // An empty hash must never validate — including against an empty password.
      expect(await verifyPasswordConstantTime("", row!.passwordHash)).toBe(false);
      expect(await verifyPasswordConstantTime("x", row!.passwordHash)).toBe(false);
    });
  });
});
