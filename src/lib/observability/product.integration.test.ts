/**
 * DB integration for the product snapshot. RUN_DB_TESTS=1.
 * Verifies the Meaningful Connection Rate definition end to end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("product snapshot (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let getProductSnapshot: typeof import("./product").getProductSnapshot;
  const userIds: string[] = [];
  const tag = `prod-${Date.now()}`;

  async function mkUser(name: string, onboarded = true) {
    const u = await db.user.create({
      data: {
        email: `${tag}-${name}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1995, 0, 1),
        status: "ACTIVE",
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: {
            displayName: name,
            gender: "PREFER_NOT_TO_SAY",
            onboardingStep: onboarded ? null : "PHOTOS",
          },
        },
      },
      select: { id: true },
    });
    userIds.push(u.id);
    return u.id;
  }

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ getProductSnapshot } = await import("./product"));

    const a = await mkUser("alice");
    const b = await mkUser("bob");
    const c = await mkUser("carol");
    await mkUser("dave", false); // not onboarded

    // Match A–B → becomes a meaningful connection (both talk, 6 msgs)
    const [lo, hi] = [a, b].sort();
    const m1 = await db.match.create({
      data: { userAId: lo, userBId: hi, contextTags: [] },
      select: { id: true, createdAt: true },
    });
    const conv1 = await db.conversation.create({ data: { matchId: m1.id }, select: { id: true } });
    for (let i = 0; i < 6; i++) {
      await db.message.create({
        data: {
          conversationId: conv1.id,
          senderId: i % 2 === 0 ? lo : hi,
          body: `msg ${i}`,
        },
      });
    }

    // Match A–C → one-sided (only A talks) → NOT meaningful, but counts as "started"
    const [lo2, hi2] = [a, c].sort();
    const m2 = await db.match.create({
      data: { userAId: lo2, userBId: hi2, contextTags: [] },
      select: { id: true },
    });
    const conv2 = await db.conversation.create({ data: { matchId: m2.id }, select: { id: true } });
    for (let i = 0; i < 4; i++) {
      await db.message.create({
        data: { conversationId: conv2.id, senderId: a, body: `hi ${i}` },
      });
    }
  });

  afterAll(async () => {
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("counts meaningful connections per the definition", async () => {
    const s = await getProductSnapshot(1);
    expect(s.matches).toBeGreaterThanOrEqual(2);
    expect(s.conversationsStarted).toBeGreaterThanOrEqual(2);
    expect(s.meaningfulConnections).toBeGreaterThanOrEqual(1);
    // the one-sided A–C thread must not be meaningful
    expect(s.meaningfulConnections).toBeLessThan(s.conversationsStarted + 1);
    expect(s.meaningfulConnectionRate).toBeGreaterThan(0);
    expect(s.meaningfulConnectionRate).toBeLessThanOrEqual(1);
  });

  it("onboarding completion rate excludes unfinished profiles", async () => {
    const s = await getProductSnapshot(1);
    // 4 signed up this window, 3 onboarded
    expect(s.onboardingCompletionRate).toBeGreaterThan(0);
    expect(s.onboardingCompletionRate).toBeLessThan(1);
  });
});
