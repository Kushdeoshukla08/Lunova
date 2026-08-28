import type { Metadata } from "next";
import Link from "next/link";
import { getModerationQueue } from "@/lib/admin/service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { REPORT_CATEGORY_LABELS } from "@/lib/enums/labels";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function ReportsQueuePage(
  props: PageProps<"/admin/reports">,
) {
  const sp = await props.searchParams;
  const status = (Array.isArray(sp.status) ? sp.status[0] : sp.status) as
    | "OPEN"
    | "REVIEWING"
    | "ACTIONED"
    | "DISMISSED"
    | undefined;
  const queue = await getModerationQueue(status ?? "OPEN");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display tracking-tight">Moderation queue</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          {(["OPEN", "REVIEWING", "ACTIONED", "DISMISSED"] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/reports?status=${s}`}
              className={`rounded-full px-2.5 py-1 ${
                (status ?? "OPEN") === s ? "bg-ink text-paper" : "bg-sand text-ink-soft"
              }`}
            >
              {s.toLowerCase()}
            </Link>
          ))}
        </nav>
      </div>

      {queue.length === 0 ? (
        <EmptyState title="Queue is clear" description="No reports in this state." />
      ) : (
        <ul className="flex flex-col gap-3">
          {queue.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/reports/${r.id}`}>
                <Card interactive className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">
                        {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
                      </span>
                      {r.subjectUser.trust && r.subjectUser.trust.reportsReceived > 1 && (
                        <Badge tone="warn">
                          {r.subjectUser.trust.reportsReceived} reports total
                        </Badge>
                      )}
                      {r.subjectUser.status !== "ACTIVE" && (
                        <Badge tone="neutral">{r.subjectUser.status}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-soft">
                      {r.subjectUser.profile?.displayName ?? "Unknown"} ·{" "}
                      {r.details ? r.details.slice(0, 80) : "no details"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatRelative(r.createdAt)}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
