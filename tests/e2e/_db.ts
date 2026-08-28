/** Direct DB access for E2E setup/teardown. */
import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/auth/password";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Force the most recent email code for a user to a known value the test can type. */
export async function setEmailCode(userEmail: string, code: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email: userEmail }, select: { id: true } });
  if (!user) return false;
  const token = await db.verificationToken.findFirst({
    where: { userId: user.id, kind: "EMAIL", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return false;
  await db.verificationToken.update({
    where: { id: token.id },
    data: { codeHash: sha256(code), attempts: 0 },
  });
  return true;
}

export async function deleteUser(email: string) {
  await db.user.deleteMany({ where: { email } });
}

/**
 * Insert a fully-onboarded, discoverable member directly — skips walking the
 * 9-step onboarding UI when a test only cares about what happens *after*.
 * Returns the plaintext password to log in with.
 */
export async function createOnboardedUser(
  email: string,
  opts: {
    age?: number;
    gender?: "WOMAN" | "MAN" | "NONBINARY";
    lat?: number;
    lng?: number;
    pref?: {
      minAge?: number;
      maxAge?: number;
      maxDistanceKm?: number;
      genders?: string[];
      globalMode?: boolean;
    };
  } = {},
): Promise<{ email: string; password: string }> {
  const password = "e2e-onboarded-pass";
  const age = opts.age ?? 30;
  const interests = await db.interest.findMany({ take: 5, select: { id: true } });
  await db.user.deleteMany({ where: { email } });
  await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      birthdate: new Date(new Date().getFullYear() - age, 5, 15),
      emailVerifiedAt: new Date(),
      ageVerifiedAt: new Date(),
      status: "ACTIVE",
      preference: {
        create: {
          minAge: opts.pref?.minAge ?? 18,
          maxAge: opts.pref?.maxAge ?? 99,
          maxDistanceKm: opts.pref?.maxDistanceKm ?? 500,
          genders: (opts.pref?.genders ?? []) as never,
          globalMode: opts.pref?.globalMode ?? false,
        },
      },
      privacy: { create: {} },
      trust: { create: { emailVerified: true } },
      notificationPref: { create: {} },
      profile: {
        create: {
          displayName: email.split("@")[0].slice(0, 20),
          gender: (opts.gender ?? "WOMAN") as never,
          onboardingStep: null,
          completeness: 80,
          relationshipIntent: "LONG_TERM",
          city: "Lisbon",
          country: "PT",
          latitude: opts.lat ?? 38.722,
          longitude: opts.lng ?? -9.139,
          locationPrecision: "CITY",
          bio: "Here for the QA pass.",
          photos: {
            create: {
              storageKey: `photos/e2e/${email.split("@")[0]}.jpg`,
              moderationStatus: "APPROVED",
              position: 0,
              isPrimary: true,
            },
          },
          interests: { create: interests.map((i) => ({ interestId: i.id })) },
        },
      },
    },
  });
  return { email, password };
}

/** Seed a one-directional LIKE so the next reciprocal like produces a match. */
export async function seedLike(fromEmail: string, toEmail: string) {
  const [from, to] = await Promise.all([
    db.user.findUnique({ where: { email: fromEmail }, select: { id: true } }),
    db.user.findUnique({ where: { email: toEmail }, select: { id: true } }),
  ]);
  if (!from || !to) throw new Error("seedLike: user not found");
  await db.like.upsert({
    where: { actorId_targetId: { actorId: from.id, targetId: to.id } },
    update: { kind: "LIKE" },
    create: { actorId: from.id, targetId: to.id, kind: "LIKE" },
  });
}

export async function clearInteractions(emails: string[]) {
  const users = await db.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await db.message.deleteMany({
    where: { conversation: { match: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } } },
  });
  await db.conversation.deleteMany({
    where: { match: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } },
  });
  await db.match.deleteMany({
    where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] },
  });
  await db.like.deleteMany({
    where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] },
  });
  await db.notification.deleteMany({ where: { userId: { in: ids } } });
}
