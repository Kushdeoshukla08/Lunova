"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/dal";
import { recordSafetyEvent } from "@/lib/safety/events";
import { revokeAllSessions } from "@/lib/auth/session";
import { notify } from "@/lib/notifications/service";
import { headers } from "next/headers";
import { ModerationActionType, ReportStatus } from "@/generated/prisma/enums";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await db.auditLog
    .create({ data: { actorId, action, entityType, entityId, metadata: metadata as object, ip } })
    .catch((e) => console.error("audit failed", e));
}

// ─── Reports ─────────────────────────────────────────────────────────────────

const resolveSchema = z.object({
  reportId: z.string().min(1),
  decision: z.enum(["DISMISSED", "ACTIONED", "REVIEWING"]),
  note: z.string().trim().max(2000).optional(),
});

export async function resolveReportAction(
  raw: z.input<typeof resolveSchema>,
): Promise<AdminResult> {
  const staff = await requireRole("ADMIN", "MODERATOR");
  const parsed = resolveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const { reportId, decision, note } = parsed.data;

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) return { ok: false, error: "Report not found." };

  await db.report.update({
    where: { id: reportId },
    data: {
      status: decision as ReportStatus,
      handledById: staff.id,
      resolutionNote: note || null,
      resolvedAt: decision === "REVIEWING" ? null : new Date(),
    },
  });
  await audit(staff.id, `report.${decision.toLowerCase()}`, "Report", reportId, { note });
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
  return { ok: true };
}

// ─── Moderation actions ──────────────────────────────────────────────────────

const modSchema = z.object({
  targetUserId: z.string().min(1),
  action: z.enum(ModerationActionType),
  reason: z.string().trim().min(3, { error: "A reason is required." }).max(1000),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
  reportId: z.string().optional(),
});

export async function applyModerationAction(
  raw: z.input<typeof modSchema>,
): Promise<AdminResult> {
  const staff = await requireRole("ADMIN", "MODERATOR");
  const parsed = modSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  }
  const { targetUserId, action, reason, durationDays, reportId } = parsed.data;
  if (targetUserId === staff.id) {
    return { ok: false, error: "You can't action your own account." };
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { role: true, status: true },
  });
  if (!target) return { ok: false, error: "That account no longer exists." };

  // Only an admin may take action against another staff member.
  if (target.role !== "USER" && staff.role !== "ADMIN") {
    return { ok: false, error: "Only an admin can moderate a staff account." };
  }
  // BAN, and un-banning via CLEAR / REINSTATE, are admin-only.
  if (action === "BAN" && staff.role !== "ADMIN") {
    return { ok: false, error: "Only admins can ban accounts." };
  }
  if (
    (action === "CLEAR" || action === "REINSTATE") &&
    target.status === "BANNED" &&
    staff.role !== "ADMIN"
  ) {
    return { ok: false, error: "Only an admin can lift a ban." };
  }

  const expiresAt =
    action === "SUSPEND" && durationDays
      ? new Date(Date.now() + durationDays * 86_400_000)
      : null;

  await db.$transaction(async (tx) => {
    await tx.moderationAction.create({
      data: { targetUserId, actorId: staff.id, action, reason, reportId, expiresAt },
    });

    if (action === "BAN") {
      await tx.user.update({ where: { id: targetUserId }, data: { status: "BANNED" } });
      await tx.match.updateMany({
        where: { closedAt: null, OR: [{ userAId: targetUserId }, { userBId: targetUserId }] },
        data: { closedAt: new Date(), closeReason: "ACCOUNT_REMOVED" },
      });
    } else if (action === "SUSPEND") {
      await tx.user.update({ where: { id: targetUserId }, data: { status: "SUSPENDED" } });
    } else if (action === "CLEAR" || action === "REINSTATE") {
      await tx.user.update({ where: { id: targetUserId }, data: { status: "ACTIVE" } });
    }

    if (action === "SUSPEND" || action === "BAN" || action === "RESTRICT_MESSAGING" || action === "RESTRICT_DISCOVERY") {
      await tx.trustProfile.update({
        where: { userId: targetUserId },
        data: { moderationStrikes: { increment: 1 }, tier: "FLAGGED" },
      });
    }
  });

  if (action === "BAN" || action === "SUSPEND") {
    await revokeAllSessions(targetUserId);
  }

  await recordSafetyEvent({
    userId: targetUserId,
    type: "MODERATION_ACTION",
    severity: action === "BAN" ? "CRITICAL" : action === "SUSPEND" ? "HIGH" : "MEDIUM",
    source: "moderation",
    metadata: { action, by: staff.id, reason },
  });
  if (action === "WARN") {
    await notify(targetUserId, "SAFETY_UPDATE", { kind: "warning", reason });
  }
  await audit(staff.id, `moderation.${action.toLowerCase()}`, "User", targetUserId, {
    reason,
    durationDays,
    reportId,
  });

  if (reportId) {
    await db.report.update({
      where: { id: reportId },
      data: { status: "ACTIONED", handledById: staff.id, resolvedAt: new Date() },
    });
  }

  revalidatePath(`/admin/users/${targetUserId}`);
  revalidatePath("/admin/reports");
  return { ok: true };
}
