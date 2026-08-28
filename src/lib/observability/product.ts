import "server-only";
import { db } from "@/lib/db";

/**
 * Product health — aggregate only. Every number here is a COUNT or a RATIO over
 * the whole population in a time window. There is no per-user breakdown, no
 * cohort drill-down, no funnel-by-identity. If a question can only be answered
 * by singling out a person, it is not answered here.
 *
 * The north star is the Meaningful Connection Rate (see `meaningfulConnectionRate`
 * below). We do NOT track — and must never optimise for — swipes, sessions,
 * time-in-app, notification opens, or raw match count.
 */

export interface ProductSnapshot {
  windowDays: number;
  since: string;

  signups: number;
  onboardingCompletionRate: number; // 0..1 of signups in window who finished onboarding

  likesSent: number;
  matches: number;
  /** matches × 2 ÷ likes — how often a like is part of a mutual choice. */
  matchRate: number;

  conversationsStarted: number; // matches in window with ≥1 human message
  conversationStartRate: number; // ÷ matches

  /**
   * THE NORTH STAR. A match becomes a *meaningful connection* when, within 14
   * days, its conversation has:
   *   • ≥1 human (non-system, non-deleted) message from BOTH people, and
   *   • ≥6 human messages in total.
   * i.e. two people actually got into a conversation — not one-sided, not "hey".
   */
  meaningfulConnections: number;
  meaningfulConnectionRate: number; // ÷ matches

  reports: number;
  blocks: number;
  /** Reports per 1,000 matches — a safety pressure gauge, not a leaderboard. */
  reportsPer1kMatches: number;
}

const MEANINGFUL_MIN_TOTAL = 6;
const MEANINGFUL_WINDOW_DAYS = 14;

function ratio(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 1000;
}

export async function getProductSnapshot(windowDays = 30): Promise<ProductSnapshot> {
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const [signups, onboarded, likesSent, matches, reports, blocks] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.user.count({
      where: { createdAt: { gte: since }, profile: { is: { onboardingStep: null } } },
    }),
    db.like.count({ where: { kind: "LIKE", createdAt: { gte: since } } }),
    db.match.count({ where: { createdAt: { gte: since } } }),
    db.report.count({ where: { createdAt: { gte: since } } }),
    db.block.count({ where: { createdAt: { gte: since } } }),
  ]);

  // Conversations started: matches in window with at least one human message.
  const startedRows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT m.id) AS n
    FROM "Match" m
    JOIN "Conversation" c ON c."matchId" = m.id
    JOIN "Message" msg ON msg."conversationId" = c.id
    WHERE m."createdAt" >= ${since}
      AND msg."senderId" IS NOT NULL
      AND msg."systemType" IS NULL
      AND msg."deletedAt" IS NULL
  `;
  const conversationsStarted = Number(startedRows[0]?.n ?? 0);

  // Meaningful connections: both people spoke, ≥6 human messages, within 14 days.
  const meaningfulRows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM (
      SELECT m.id
      FROM "Match" m
      JOIN "Conversation" c ON c."matchId" = m.id
      JOIN "Message" msg ON msg."conversationId" = c.id
      WHERE m."createdAt" >= ${since}
        AND msg."senderId" IS NOT NULL
        AND msg."systemType" IS NULL
        AND msg."deletedAt" IS NULL
        AND msg."createdAt" <= m."createdAt" + make_interval(days => ${MEANINGFUL_WINDOW_DAYS})
      GROUP BY m.id
      HAVING COUNT(msg.id) >= ${MEANINGFUL_MIN_TOTAL}
         AND COUNT(DISTINCT msg."senderId") >= 2
    ) meaningful
  `;
  const meaningfulConnections = Number(meaningfulRows[0]?.n ?? 0);

  return {
    windowDays,
    since: since.toISOString(),
    signups,
    onboardingCompletionRate: ratio(onboarded, signups),
    likesSent,
    matches,
    matchRate: Math.min(1, ratio(matches * 2, likesSent)),
    conversationsStarted,
    conversationStartRate: ratio(conversationsStarted, matches),
    meaningfulConnections,
    meaningfulConnectionRate: ratio(meaningfulConnections, matches),
    reports,
    blocks,
    reportsPer1kMatches: matches > 0 ? Math.round((reports / matches) * 1000) : 0,
  };
}
