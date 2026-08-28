import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportDetail } from "@/lib/admin/service";
import { UserAdminSummary } from "@/components/admin/user-admin-summary";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REPORT_CATEGORY_LABELS } from "@/lib/enums/labels";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Report" };

export default async function ReportDetailPage(props: PageProps<"/admin/reports/[id]">) {
  const { id } = await props.params;
  const detail = await getReportDetail(id);
  if (!detail || !detail.subject) notFound();
  const { report, subject } = detail;
  const ctx = (report.context ?? {}) as {
    conversationId?: string;
    recentMessages?: { id: string; body: string; senderId: string | null }[];
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/reports"
        className="tap-target w-fit text-sm text-ink-soft hover:text-ink"
      >
        ← Queue
      </Link>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>{REPORT_CATEGORY_LABELS[report.category] ?? report.category}</CardTitle>
          <Badge tone={report.status === "OPEN" ? "warn" : "neutral"}>{report.status}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-faint">
          Reported by {report.reporter.profile?.displayName ?? "unknown"} ·{" "}
          {formatRelative(report.createdAt)}
        </p>
        {report.details && (
          <p className="mt-3 rounded-[var(--radius-sm)] bg-sand px-3 py-2 text-sm text-ink">
            {report.details}
          </p>
        )}
        {ctx.recentMessages && ctx.recentMessages.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
              Conversation snapshot
            </p>
            <ul className="mt-1 space-y-1 text-sm">
              {ctx.recentMessages.map((m) => (
                <li key={m.id} className="text-ink-soft">
                  <span className="text-ink-faint">
                    {m.senderId === subject.user.id ? "subject" : "reporter"}:
                  </span>{" "}
                  {m.body}
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.resolutionNote && (
          <p className="mt-3 text-xs text-ink-faint">
            Resolution: {report.resolutionNote}
          </p>
        )}
      </Card>

      <UserAdminSummary view={subject} />

      {report.status === "OPEN" || report.status === "REVIEWING" ? (
        <ModerationPanel targetUserId={subject.user.id} reportId={report.id} />
      ) : (
        <p className="text-sm text-ink-faint">
          This report is {report.status.toLowerCase()}.
        </p>
      )}
    </div>
  );
}
