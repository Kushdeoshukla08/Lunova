/**
 * DB integration for account deletion / anonymisation. RUN_DB_TESTS=1.
 * (Notification/privacy update actions need a request context, so those are
 *  covered by the service-level assertions and the browser pass.)
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("account deletion (DB)", () => {
  let db: typeof import("@/lib/db").db;
  const created: string[] = [];
  const tag = `del-${Date.now()}`;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
  });

  afterAll(async () => {
    if (created.length) await db.user.deleteMany({ where: { id: { in: created } } });
  });

  it("anonymises the user shell and removes profile + matches", async () => {
    // Build a small graph: victim + a match with someone else + a photo row.
    const other = await db.user.create({
      data: {
        email: `${tag}-other@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1995, 0, 1),
        status: "ACTIVE",
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: { create: { displayName: "Other", gender: "NONBINARY", onboardingStep: null } },
      },
      select: { id: true },
    });
    created.push(other.id);

    const user = await db.user.create({
      data: {
        email: `${tag}-victim@demo.lunova.local`,
        passwordHash: "hash",
        phone: "+10000000000",
        birthdate: new Date(1996, 0, 1),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: {
            displayName: "Victim",
            gender: "NONBINARY",
            bio: "sensitive text",
            onboardingStep: null,
            photos: { create: { storageKey: "photos/x/y/v.png", moderationStatus: "APPROVED", position: 0, isPrimary: true } },
          },
        },
      },
      select: { id: true },
    });
    created.push(user.id);

    const [a, b] = [user.id, other.id].sort();
    const match = await db.match.create({
      data: { userAId: a, userBId: b, conversation: { create: {} } },
      select: { id: true },
    });

    // Run the action with a stubbed session (so requireUser resolves) — we only
    // assert the DB effects, so mock the pieces that need a request.
    vi.doMock("@/lib/auth/dal", () => ({
      requireUser: async () => ({ id: user.id, email: `${tag}-victim@demo.lunova.local` }),
    }));
    vi.doMock("@/lib/auth/session", () => ({
      destroySession: async () => {},
      revokeAllSessions: async () => {},
      readSession: async () => null,
    }));
    vi.doMock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));
    vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));

    const { deleteAccountAction } = await import("./actions");
    const fd = new FormData();
    fd.set("confirm", "delete");
    await expect(deleteAccountAction(null, fd)).rejects.toThrow("REDIRECT");

    const shell = await db.user.findUnique({ where: { id: user.id } });
    expect(shell!.status).toBe("DELETED");
    expect(shell!.email).toBe(`deleted+${user.id}@lunova.invalid`);
    expect(shell!.phone).toBeNull();
    expect(shell!.passwordHash).toBe("");
    expect(shell!.deletedAt).toBeTruthy();

    expect(await db.profile.findUnique({ where: { userId: user.id } })).toBeNull();
    const closed = await db.match.findUnique({ where: { id: match.id } });
    expect(closed!.closedAt).toBeTruthy();
    expect(closed!.closeReason).toBe("ACCOUNT_REMOVED");

    vi.resetModules();
  });
});
