/**
 * DB integration — a one-sided like must not identify the person who sent it.
 *
 * Liking someone is not consent to be named to them. Revealing the liker before
 * it is mutual routes around `incognito` and `LIMITED` visibility (you can hide
 * from someone's Discover and still have your name pushed to their
 * notifications) and turns the list into a "who likes me" feed, which is the
 * mechanic this product deliberately does not have.
 *
 * Skipped unless RUN_DB_TESTS=1.
 *
 *   RUN_DB_TESTS=1 npx vitest run src/lib/notifications/like-anonymity
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("like anonymity (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let recordLikeAndMaybeMatch: typeof import("@/lib/matching/service").recordLikeAndMaybeMatch;
  let listNotifications: typeof import("./service").listNotifications;
  let decorateNotifications: typeof import("./service").decorateNotifications;

  const tag = `likeanon-${Date.now()}`;
  const ids: string[] = [];
  let admirer = "";
  let admired = "";

  const ADMIRER_NAME = `Wren${Date.now().toString().slice(-5)}`;

  async function member(name: string) {
    const u = await db.user.create({
      data: {
        email: `${tag}-${name}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(new Date().getFullYear() - 30, 0, 1),
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        preference: {
          create: { minAge: 18, maxAge: 99, maxDistanceKm: 500, genders: [], globalMode: true },
        },
        // Incognito is the sharpest case: this person is explicitly hidden.
        privacy: { create: { incognito: name === ADMIRER_NAME } },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: {
            displayName: name,
            gender: "NONBINARY",
            onboardingStep: null,
            relationshipIntent: "LONG_TERM",
            latitude: 38.72,
            longitude: -9.13,
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
    ({ recordLikeAndMaybeMatch } = await import("@/lib/matching/service"));
    ({ listNotifications, decorateNotifications } = await import("./service"));

    admirer = await member(ADMIRER_NAME);
    admired = await member("Admired");
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    await db.match.deleteMany({
      where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("tells you someone liked you without saying who", async () => {
    const outcome = await recordLikeAndMaybeMatch({
      actorId: admirer,
      targetId: admired,
      kind: "LIKE",
      comment: "that three-hour-walk answer got me",
    });
    expect(outcome.matched).toBe(false);

    const raw = await listNotifications(admired, { limit: 20 });
    const like = raw.find((n) => n.type === "NEW_LIKE");
    expect(like, "no NEW_LIKE notification was created").toBeDefined();

    // Not merely hidden in the UI — the stored payload must not carry the id,
    // so nothing downstream can resolve it either.
    expect(JSON.stringify(like!.payload ?? {})).not.toContain(admirer);

    const [shown] = await decorateNotifications(admired, [like!]);
    expect(shown.title).toBe("Someone liked you");
    expect(shown.title).not.toContain(ADMIRER_NAME);
    expect(JSON.stringify(shown)).not.toContain(ADMIRER_NAME);
    expect(JSON.stringify(shown)).not.toContain(admirer);

    // The words they chose to send are theirs to send, and are what makes the
    // notification worth reading.
    expect(shown.body).toContain("three-hour-walk");
  });

  it("names them only once the like is mutual", async () => {
    const outcome = await recordLikeAndMaybeMatch({
      actorId: admired,
      targetId: admirer,
      kind: "LIKE",
    });
    expect(outcome.matched).toBe(true);

    const raw = await listNotifications(admired, { limit: 20 });
    const match = raw.find((n) => n.type === "NEW_MATCH");
    expect(match).toBeDefined();

    const [shown] = await decorateNotifications(admired, [match!]);
    expect(shown.title).toBe(`You matched with ${ADMIRER_NAME}`);
  });
});
