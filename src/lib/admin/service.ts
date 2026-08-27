import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/providers/storage";

export async function getAdminDashboard() {
  const [openReports, reviewing, pendingIdChecks, recentEvents, activeUsers] =
    await Promise.all([
      db.report.count({ where: { status: "OPEN" } }),
      db.report.count({ where: { status: "REVIEWING" } }),
      db.identityCheck.count({ where: { status: "PENDING" } }),
      db.safetyEvent.findMany({
        where: { severity: { in: ["MEDIUM", "HIGH", "CRITICAL"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, type: true, severity: true, createdAt: true, userId: true },
      }),
      db.user.count({ where: { status: "ACTIVE" } }),
    ]);
  return { openReports, reviewing, pendingIdChecks, recentEvents, activeUsers };
}

export async function getModerationQueue(status: "OPEN" | "REVIEWING" | "ACTIONED" | "DISMISSED" = "OPEN") {
  const reports = await db.report.findMany({
    where: { status },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      category: true,
      createdAt: true,
      details: true,
      reporter: { select: { id: true, profile: { select: { displayName: true } } } },
      subjectUser: {
        select: {
          id: true,
          status: true,
          profile: { select: { displayName: true } },
          trust: { select: { reportsReceived: true, tier: true } },
        },
      },
    },
  });
  return reports;
}

export async function getReportDetail(reportId: string) {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      category: true,
      details: true,
      context: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolutionNote: true,
      reporter: { select: { id: true, profile: { select: { displayName: true } } } },
      subjectUser: { select: { id: true } },
    },
  });
  if (!report) return null;
  const subject = await getUserAdminView(report.subjectUser.id);
  return { report, subject };
}

export async function getUserAdminView(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      createdAt: true,
      lastActiveAt: true,
      deletedAt: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      profile: {
        select: {
          displayName: true,
          city: true,
          country: true,
          photos: {
            orderBy: { position: "asc" },
            select: { id: true, storageKey: true, moderationStatus: true },
          },
        },
      },
      trust: true,
    },
  });
  if (!user) return null;

  const [reportsAbout, reportsBy, moderation, events] = await Promise.all([
    db.report.findMany({
      where: { subjectUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, category: true, status: true, createdAt: true },
    }),
    db.report.count({ where: { reporterId: userId } }),
    db.moderationAction.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, action: true, reason: true, createdAt: true, expiresAt: true },
    }),
    db.safetyEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, type: true, severity: true, source: true, createdAt: true },
    }),
  ]);

  return {
    user: {
      ...user,
      photos: (user.profile?.photos ?? []).map((p) => ({
        ...p,
        url: storage.publicUrl(p.storageKey),
      })),
    },
    reportsAbout,
    reportsBy,
    moderation,
    events,
  };
}
