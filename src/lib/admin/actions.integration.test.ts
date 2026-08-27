/**
 * DB integration for moderation actions + verification. RUN_DB_TESTS=1.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("moderation + verification (DB)", () => {
  let db: typeof import("@/lib/db").db;
  const ids: string[] = [];
  const tag = `mod-${Date.now()}`;
  let adminId = "";
  let targetId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    const admin = await db.user.create({
      data: {
        email: `${tag}-admin@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1990, 0, 1),
        status: "ACTIVE",
        role: "ADMIN",
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: { create: { displayName: "Admin", gender: "PREFER_NOT_TO_SAY", onboardingStep: null } },
      },
      select: { id: true },
    });
    const target = await db.user.create({
      data: {
        email: `${tag}-target@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1996, 0, 1),
        status: "ACTIVE",
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: { create: { displayName: "Target", gender: "NONBINARY", onboardingStep: null } },
        sessions: { create: { tokenHash: `${tag}-sess`, expiresAt: new Date(Date.now() + 1e9) } },
      },
      select: { id: true },
    });
    adminId = admin.id;
    targetId = target.id;
    ids.push(adminId, targetId);
  });

  afterAll(async () => {
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("applyModerationAction BAN: status BANNED, sessions revoked, strike + audit log", async () => {
    vi.doMock("@/lib/auth/dal", () => ({
      requireRole: async () => ({ id: adminId, email: "a@x", role: "ADMIN" }),
    }));
    vi.doMock("next/headers", () => ({ headers: async () => new Headers() }));
    vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));

    const { applyModerationAction } = await import("./actions");
    const res = await applyModerationAction({
      targetUserId: targetId,
      action: "BAN" as never,
      reason: "integration test ban",
    });
    expect(res.ok).toBe(true);

    const user = await db.user.findUnique({ where: { id: targetId } });
    expect(user!.status).toBe("BANNED");

    const liveSessions = await db.session.count({
      where: { userId: targetId, revokedAt: null },
    });
    expect(liveSessions).toBe(0);

    const trust = await db.trustProfile.findUnique({ where: { userId: targetId } });
    expect(trust!.moderationStrikes).toBe(1);
    expect(trust!.tier).toBe("FLAGGED");

    const audit = await db.auditLog.findFirst({
      where: { actorId: adminId, entityId: targetId, action: "moderation.ban" },
    });
    expect(audit).toBeTruthy();

    const event = await db.safetyEvent.findFirst({
      where: { userId: targetId, type: "MODERATION_ACTION", severity: "CRITICAL" },
    });
    expect(event).toBeTruthy();

    vi.resetModules();
  });

  it("confirmPhone sets phoneVerifiedAt + trust.phoneVerified on the right code", async () => {
    const { startPhoneVerification, confirmPhone } = await import("@/lib/verification/service");
    // capture the code by spying on the sms provider
    const sms = await import("@/lib/providers/sms");
    let sent = "";
    const spy = vi.spyOn(sms.smsProvider, "send").mockImplementation(async ({ text }) => {
      sent = text.match(/\b(\d{6})\b/)?.[1] ?? "";
    });

    await startPhoneVerification(adminId, "+14155550123");
    expect(sent).toMatch(/^\d{6}$/);

    const bad = await confirmPhone(adminId, "000000");
    expect(bad.ok).toBe(false);

    const ok = await confirmPhone(adminId, sent);
    expect(ok.ok).toBe(true);
    const u = await db.user.findUnique({ where: { id: adminId } });
    expect(u!.phoneVerifiedAt).toBeTruthy();
    const t = await db.trustProfile.findUnique({ where: { userId: adminId } });
    expect(t!.phoneVerified).toBe(true);

    spy.mockRestore();
  });
});
