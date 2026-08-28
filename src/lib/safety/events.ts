import "server-only";
import { db } from "@/lib/db";
import { captureError } from "@/lib/observability/errors";
import type {
  SafetyEventType,
  SafetySeverity,
} from "@/generated/prisma/enums";

/**
 * Append-only private safety signals. These feed the internal Trust & Safety
 * system and moderation queues — they are NEVER exposed to other users and never
 * surfaced as a public score. Best-effort: a logging failure must not break the
 * user-facing action.
 */
export async function recordSafetyEvent(input: {
  userId: string;
  type: SafetyEventType;
  severity?: SafetySeverity;
  source: "auth" | "moderation" | "matching" | "system";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.safetyEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        severity: input.severity ?? "INFO",
        source: input.source,
        metadata: input.metadata as object | undefined,
      },
    });
  } catch (err) {
    captureError(err, { scope: "safety.recordSafetyEvent" });
  }
}

export async function recordLoginAttempt(input: {
  email: string;
  success: boolean;
  reason?: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await db.loginAttempt.create({
      data: {
        email: input.email,
        success: input.success,
        reason: input.reason,
        userId: input.userId ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
    });
  } catch (err) {
    captureError(err, { scope: "safety.recordLoginAttempt" });
  }
}

/** Count recent failed logins for an account — used to detect credential stuffing. */
export async function recentFailedLogins(email: string, windowMs = 15 * 60 * 1000) {
  return db.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: new Date(Date.now() - windowMs) },
    },
  });
}
