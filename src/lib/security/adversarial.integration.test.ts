/**
 * Adversarial security tests — actual attempts to break authorization,
 * privacy, and OTP handling. RUN_DB_TESTS=1 (Postgres on :5433).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

d("adversarial (DB)", () => {
  let db: typeof import("@/lib/db").db;
  const tag = `sec-${Date.now()}`;
  const ids: Record<string, string> = {};

  async function mkUser(
    key: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
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
        profile: {
          create: { displayName: key, gender: "NONBINARY", onboardingStep: null },
        },
        ...extra,
      },
      select: { id: true },
    });
    ids[key] = u.id;
    return u.id;
  }

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    await mkUser("alice");
    await mkUser("bob");
    await mkUser("mallory");
    await mkUser("mod", { role: "MODERATOR" });
    await mkUser("admin", { role: "ADMIN" });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  // ── S1: LIMITED profile visibility ────────────────────────────────────────
  describe("profileVisibility LIMITED", () => {
    it("hides a LIMITED profile from a viewer it hasn't liked, in feed and profile view", async () => {
      const { getPublicProfile } = await import("@/lib/profile/view");
      const { getDiscoveryFeed } = await import("@/lib/discovery/service");

      await db.privacySetting.update({
        where: { userId: ids.bob },
        data: { profileVisibility: "LIMITED" },
      });
      // give bob a photo so he'd otherwise be feed-eligible
      await db.photo.create({
        data: { profileId: (await profileId(ids.bob)), storageKey: "photos/x/y/bob.png", moderationStatus: "APPROVED", position: 0, isPrimary: true },
      });

      expect(await getPublicProfile(ids.alice, ids.bob)).toBeNull();
      const feed = await getDiscoveryFeed(ids.alice, { limit: 50 });
      expect(feed.some((p) => p.userId === ids.bob)).toBe(false);
    });

    it("shows the LIMITED profile once its owner has liked the viewer", async () => {
      const { getPublicProfile } = await import("@/lib/profile/view");
      await db.like.create({
        data: { actorId: ids.bob, targetId: ids.alice, kind: "LIKE" },
      });
      const p = await getPublicProfile(ids.alice, ids.bob);
      expect(p).toBeTruthy();
      expect(p!.userId).toBe(ids.bob);

      // reset
      await db.like.deleteMany({ where: { actorId: ids.bob, targetId: ids.alice } });
      await db.privacySetting.update({
        where: { userId: ids.bob },
        data: { profileVisibility: "DISCOVERABLE" },
      });
    });
  });

  // ── cross-user access ─────────────────────────────────────────────────────
  describe("cross-user access", () => {
    it("getConversation returns null to a non-participant", async () => {
      const { recordLikeAndMaybeMatch } = await import("@/lib/matching/service");
      const { getConversation } = await import("@/lib/conversations/service");
      await recordLikeAndMaybeMatch({ actorId: ids.alice, targetId: ids.bob, kind: "LIKE" });
      const out = await recordLikeAndMaybeMatch({ actorId: ids.bob, targetId: ids.alice, kind: "LIKE" });
      const convoId = out.conversationId!;

      expect(await getConversation(ids.mallory, convoId)).toBeNull();
      expect(await getConversation(ids.alice, convoId)).toBeTruthy();
    });

    it("closeMatch refuses a match the actor is not part of", async () => {
      const { closeMatch } = await import("@/lib/safety/service");
      const match = await db.match.findFirst({
        where: { OR: [{ userAId: ids.alice }, { userBId: ids.alice }] },
        select: { id: true },
      });
      expect(await closeMatch(ids.mallory, match!.id, "UNMATCHED")).toBe(false);
      // still open
      const still = await db.match.findUnique({ where: { id: match!.id }, select: { closedAt: true } });
      expect(still!.closedAt).toBeNull();
    });
  });

  // ── S10: blocked party loses read access ──────────────────────────────────
  it("a blocked user cannot re-open the frozen conversation", async () => {
    const { blockUser } = await import("@/lib/safety/service");
    const { getConversation } = await import("@/lib/conversations/service");
    const match = await db.match.findFirst({
      where: {
        OR: [
          { userAId: ids.alice, userBId: ids.bob },
          { userAId: ids.bob, userBId: ids.alice },
        ],
      },
      select: { id: true, conversation: { select: { id: true } } },
    });
    const convoId = match!.conversation!.id;

    await blockUser(ids.alice, ids.bob); // alice blocks bob
    expect(await getConversation(ids.bob, convoId)).toBeNull(); // blocked party
    expect(await getConversation(ids.alice, convoId)).toBeTruthy(); // blocker keeps read-only

    await db.block.deleteMany({ where: { blockerId: ids.alice, blockedId: ids.bob } });
  });

  // ── S4: report cannot snapshot a foreign conversation ─────────────────────
  it("reportAction does not capture messages from a conversation the reporter isn't in", async () => {
    vi.resetModules();
    vi.doMock("@/lib/auth/dal", () => ({
      requireOnboardedUser: async () => ({ id: ids.mallory, email: "m@x" }),
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
    const { reportAction } = await import("@/lib/safety/actions");

    const foreign = await db.match.findFirst({
      where: {
        OR: [
          { userAId: ids.alice, userBId: ids.bob },
          { userAId: ids.bob, userBId: ids.alice },
        ],
      },
      select: { conversation: { select: { id: true } } },
    });
    await db.message.create({
      data: {
        conversationId: foreign!.conversation!.id,
        senderId: ids.alice,
        body: "private between alice and bob",
      },
    });

    const res = await reportAction({
      subjectUserId: ids.bob,
      category: "HARASSMENT",
      conversationId: foreign!.conversation!.id,
    });
    expect(res.ok).toBe(true);

    const report = await db.report.findFirst({
      where: { reporterId: ids.mallory, subjectUserId: ids.bob },
      orderBy: { createdAt: "desc" },
    });
    const ctx = (report!.context ?? {}) as { recentMessages?: unknown[] };
    expect(ctx.recentMessages ?? []).toHaveLength(0);

    vi.resetModules();
  });

  // ── S3: moderator privilege limits ───────────────────────────────────────
  describe("moderation privilege limits", () => {
    async function callMod(actorId: string, actorRole: string, input: Record<string, unknown>) {
      vi.resetModules();
      vi.doMock("@/lib/auth/dal", () => ({
        requireRole: async () => ({ id: actorId, email: "s@x", role: actorRole }),
      }));
      vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
      vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
      const { applyModerationAction } = await import("@/lib/admin/actions");
      const r = await applyModerationAction(input as never);
      vi.resetModules();
      return r;
    }

    it("a MODERATOR cannot BAN", async () => {
      const r = await callMod(ids.mod, "MODERATOR", {
        targetUserId: ids.mallory,
        action: "BAN",
        reason: "attempt",
      });
      expect(r.ok).toBe(false);
    });

    it("a MODERATOR cannot action another staff account", async () => {
      const r = await callMod(ids.mod, "MODERATOR", {
        targetUserId: ids.admin,
        action: "SUSPEND",
        reason: "attempt",
        durationDays: 3,
      });
      expect(r.ok).toBe(false);
      const admin = await db.user.findUnique({ where: { id: ids.admin }, select: { status: true } });
      expect(admin!.status).toBe("ACTIVE");
    });

    it("a MODERATOR cannot lift a ban via REINSTATE", async () => {
      await db.user.update({ where: { id: ids.mallory }, data: { status: "BANNED" } });
      const r = await callMod(ids.mod, "MODERATOR", {
        targetUserId: ids.mallory,
        action: "REINSTATE",
        reason: "attempt",
      });
      expect(r.ok).toBe(false);
      const m = await db.user.findUnique({ where: { id: ids.mallory }, select: { status: true } });
      expect(m!.status).toBe("BANNED");
      await db.user.update({ where: { id: ids.mallory }, data: { status: "ACTIVE" } });
    });
  });

  // ── S5: OTP attempt lockout ──────────────────────────────────────────────
  it("a verification code is burned after 5 wrong guesses", async () => {
    const { confirmPhone } = await import("@/lib/verification/service");
    const target = "+15550001111";
    await db.verificationToken.create({
      data: {
        userId: ids.alice,
        kind: "PHONE",
        target,
        codeHash: sha("123456"),
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    for (let i = 0; i < 5; i++) {
      const r = await confirmPhone(ids.alice, "000000");
      expect(r.ok).toBe(false);
    }
    // now the RIGHT code must also fail — the token is consumed
    const r = await confirmPhone(ids.alice, "123456");
    expect(r.ok).toBe(false);
    await db.verificationToken.deleteMany({ where: { userId: ids.alice } });
  });

  async function profileId(userId: string): Promise<string> {
    const p = await db.profile.findUniqueOrThrow({ where: { userId }, select: { id: true } });
    return p.id;
  }
});
