import "server-only";
import { db } from "@/lib/db";
import { recordSafetyEvent } from "./events";
import type { ReportCategory } from "@/generated/prisma/enums";

/**
 * First-class safety operations. These are never rate-limited into uselessness
 * and never paywalled. Reports and trust signals stay private.
 */

/** Close a match from either side. Idempotent. */
export async function closeMatch(
  actorId: string,
  matchId: string,
  reason: "UNMATCHED" | "BLOCKED" | "REPORTED",
): Promise<boolean> {
  const match = await db.match.findFirst({
    where: {
      id: matchId,
      OR: [{ userAId: actorId }, { userBId: actorId }],
    },
    select: { id: true, closedAt: true },
  });
  if (!match) return false;
  if (match.closedAt) return true;
  await db.match.update({
    where: { id: match.id },
    data: { closedAt: new Date(), closedById: actorId, closeReason: reason },
  });
  return true;
}

/** Block a user: closes any match, hides both from each other's surfaces. */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return;
  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });

  const shared = await db.match.findMany({
    where: {
      OR: [
        { userAId: blockerId, userBId: blockedId },
        { userAId: blockedId, userBId: blockerId },
      ],
      closedAt: null,
    },
    select: { id: true },
  });
  await Promise.all(shared.map((m) => closeMatch(blockerId, m.id, "BLOCKED")));

  await Promise.all([
    recordSafetyEvent({
      userId: blockedId,
      type: "BLOCK_RECEIVED",
      severity: "LOW",
      source: "moderation",
      metadata: { by: blockerId },
    }),
    db.trustProfile
      .update({ where: { userId: blockedId }, data: {} })
      .catch(() => {}),
  ]);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await db.block
    .delete({ where: { blockerId_blockedId: { blockerId, blockedId } } })
    .catch(() => {});
}

/** File a report. Logged securely; feeds the moderation queue and trust signals. */
export async function fileReport(input: {
  reporterId: string;
  subjectUserId: string;
  category: ReportCategory;
  details?: string;
  context?: Record<string, unknown>;
}): Promise<string> {
  const report = await db.report.create({
    data: {
      reporterId: input.reporterId,
      subjectUserId: input.subjectUserId,
      category: input.category,
      details: input.details || null,
      context: input.context as object | undefined,
    },
    select: { id: true },
  });

  await recordSafetyEvent({
    userId: input.subjectUserId,
    type: "REPORT_RECEIVED",
    severity: "MEDIUM",
    source: "moderation",
    metadata: { reportId: report.id, category: input.category },
  });
  await db.trustProfile
    .update({
      where: { userId: input.subjectUserId },
      data: { reportsReceived: { increment: 1 } },
    })
    .catch(() => {});

  return report.id;
}

/** Whether A has blocked B or vice versa. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const row = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}
