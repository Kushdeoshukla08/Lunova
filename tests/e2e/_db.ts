/** Direct DB access for E2E setup/teardown. */
import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

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
