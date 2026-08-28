/**
 * Abuse & safety testing — persona-driven attempts to break the safety
 * mechanisms (spammer, harasser, scammer, mass-liker). RUN_DB_TESTS=1.
 *
 * See docs/ABUSE-TESTING.md for the narrative and the fixes these lock in.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("abuse & safety (DB)", () => {
  let db: typeof import("@/lib/db").db;
  const tag = `abuse-${Date.now()}`;
  const ids: Record<string, string> = {};

  async function mkUser(key: string, extra: Record<string, unknown> = {}): Promise<string> {
    const u = await db.user.create({
      data: {
        email: `${tag}-${key}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1995, 0, 1),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: { create: { displayName: key, gender: "NONBINARY", onboardingStep: null } },
        ...extra,
      },
      select: { id: true },
    });
    ids[key] = u.id;
    return u.id;
  }

  /** Open match + conversation between two users. */
  async function connect(a: string, b: string) {
    const [lo, hi] = [a, b].sort();
    const match = await db.match.create({
      data: { userAId: lo, userBId: hi, contextTags: [] },
      select: { id: true },
    });
    const convo = await db.conversation.create({
      data: { matchId: match.id },
      select: { id: true },
    });
    return { matchId: match.id, conversationId: convo.id };
  }

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    // each pairing needs distinct users — Match has a unique (userA, userB).
    for (const k of [
      "harasser", "hVictim",
      "readBlocker", "readBlocked",
      "lateBlocker", "lateBlocked",
      "spammer", "sVictim",
      "scammer",
    ]) {
      await mkUser(k);
    }
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  // ── Harasser: keeps contacting someone who blocked them ────────────────────
  describe("harasser after a block", () => {
    it("cannot send into a conversation once blocked, even if the match row lags", async () => {
      const { conversationId } = await connect(ids.hVictim, ids.harasser);
      const { blockUser } = await import("@/lib/safety/service");
      await blockUser(ids.hVictim, ids.harasser);

      vi.doMock("@/lib/auth/dal", () => ({
        requireOnboardedUser: async () => ({ id: ids.harasser }),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
      const { sendMessageAction } = await import("@/lib/messaging/actions");

      const res = await sendMessageAction({ conversationId, body: "let me back in" });
      expect(res.ok).toBe(false);
      vi.resetModules();
    });

    it("loses read access to the thread; the blocker keeps it", async () => {
      const { conversationId } = await connect(ids.readBlocker, ids.readBlocked);
      const { blockUser } = await import("@/lib/safety/service");
      const { getConversation } = await import("@/lib/conversations/service");

      await blockUser(ids.readBlocker, ids.readBlocked);
      expect(await getConversation(ids.readBlocked, conversationId)).toBeNull();
      expect(await getConversation(ids.readBlocker, conversationId)).not.toBeNull();
    });

    it("unmatch-then-block still hides the thread from the blocked party", async () => {
      const { matchId, conversationId } = await connect(ids.lateBlocker, ids.lateBlocked);
      const { closeMatch, blockUser } = await import("@/lib/safety/service");
      const { getConversation } = await import("@/lib/conversations/service");

      // lateBlocked unmatches first (closeReason = UNMATCHED, closedById = lateBlocked)
      await closeMatch(ids.lateBlocked, matchId, "UNMATCHED");
      // lateBlocker then blocks them
      await blockUser(ids.lateBlocker, ids.lateBlocked);

      expect(await getConversation(ids.lateBlocked, conversationId)).toBeNull();
      expect(await getConversation(ids.lateBlocker, conversationId)).not.toBeNull();
    });
  });

  // ── Spammer: one-sided message flood ──────────────────────────────────────
  describe("one-sided flood", () => {
    it("stops the sender after UNANSWERED_LIMIT messages with no reply", async () => {
      const { conversationId } = await connect(ids.spammer, ids.sVictim);

      // 12 messages already sent by spammer, none from victim
      for (let i = 0; i < 12; i++) {
        await db.message.create({
          data: { conversationId, senderId: ids.spammer, body: `ping ${i}` },
        });
      }

      vi.doMock("@/lib/auth/dal", () => ({
        requireOnboardedUser: async () => ({ id: ids.spammer }),
      }));
      vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
      const { sendMessageAction } = await import("@/lib/messaging/actions");

      const res = await sendMessageAction({ conversationId, body: "13th" });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/chance to reply/i);

      // a reply from the victim resets the count
      await db.message.create({
        data: { conversationId, senderId: ids.sVictim, body: "stop" },
      });
      const res2 = await sendMessageAction({ conversationId, body: "ok sorry" });
      expect(res2.ok).toBe(true);

      const spam = await db.safetyEvent.findFirst({
        where: { userId: ids.spammer, type: "MESSAGE_SPAM_SUSPECTED" },
      });
      expect(spam).toBeTruthy();
      vi.resetModules();
    });
  });

  // ── Scammer: contact-info / off-platform push in profile copy ─────────────
  describe("profile free-text screening", () => {
    it("blocks a rejectable bio at save time", async () => {
      const { screenProfileText } = await import("@/lib/profile/moderation");
      const bad = await screenProfileText(ids.scammer, [
        { name: "bio", value: "add me kys loser" }, // heuristic slur → reject
      ]);
      expect(bad.ok).toBe(false);
    });

    it("allows a contact-info bio but records a CONTENT_FLAGGED event for review", async () => {
      const { screenProfileText } = await import("@/lib/profile/moderation");
      const res = await screenProfileText(ids.scammer, [
        { name: "bio", value: "hit me on telegram @scammer" }, // → review
      ]);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.flagged).toContain("bio");

      const evt = await db.safetyEvent.findFirst({
        where: { userId: ids.scammer, type: "CONTENT_FLAGGED" },
      });
      expect(evt).toBeTruthy();
    });
  });
});
