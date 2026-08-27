"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { rateLimiter, RATE_RULES } from "@/lib/rate-limit";
import { blockSchema, reportSchema } from "@/lib/validation/safety";
import { blockUser, closeMatch, fileReport, unblockUser } from "./service";
import { db } from "@/lib/db";

export type SafetyResult = { ok: true } | { ok: false; error: string };

/** Unmatch — ends the connection and hides the thread for both people. */
export async function unmatchAction(matchId: string): Promise<SafetyResult> {
  const user = await requireOnboardedUser();
  const done = await closeMatch(user.id, matchId, "UNMATCHED");
  if (!done) return { ok: false, error: "That connection isn't available." };
  revalidatePath("/connections");
  redirect("/connections");
}

/** Block — always available, never rate-limited away. Also closes any match. */
export async function blockAction(
  raw: { userId: string; alsoReport?: boolean; category?: string; details?: string },
): Promise<SafetyResult> {
  const user = await requireOnboardedUser();
  const parsed = blockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { userId, alsoReport, category, details } = parsed.data;
  if (userId === user.id) return { ok: false, error: "You can't block yourself." };

  await blockUser(user.id, userId);
  if (alsoReport && category) {
    await fileReport({
      reporterId: user.id,
      subjectUserId: userId,
      category,
      details,
      context: { via: "block" },
    });
  }
  revalidatePath("/connections");
  revalidatePath("/discover");
  return { ok: true };
}

export async function unblockAction(userId: string): Promise<SafetyResult> {
  const user = await requireOnboardedUser();
  await unblockUser(user.id, userId);
  revalidatePath("/settings/privacy");
  return { ok: true };
}

/** Report — structured categories, logged privately for the moderation queue. */
export async function reportAction(
  raw: {
    subjectUserId: string;
    category: string;
    details?: string;
    conversationId?: string;
    messageId?: string;
  },
): Promise<SafetyResult> {
  const user = await requireOnboardedUser();
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }
  const { subjectUserId, category, details, conversationId, messageId } = parsed.data;
  if (subjectUserId === user.id) return { ok: false, error: "Invalid report." };

  const limit = await rateLimiter.check(`report:${user.id}`, RATE_RULES.reports);
  if (!limit.ok) {
    return { ok: false, error: "You've filed several reports recently. Our team is on it." };
  }

  // capture a small evidence snapshot for the moderation queue
  let context: Record<string, unknown> = {};
  if (conversationId) {
    const recent = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, body: true, senderId: true, createdAt: true },
    });
    context = { conversationId, messageId, recentMessages: recent.reverse() };
  }

  await fileReport({
    reporterId: user.id,
    subjectUserId,
    category,
    details: details || undefined,
    context,
  });
  revalidatePath("/connections");
  return { ok: true };
}
