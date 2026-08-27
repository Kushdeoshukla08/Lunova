import type { Metadata } from "next";
import Link from "next/link";
import { getAdminDashboard } from "@/lib/admin/service";
import { Card, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "T&S Dashboard" };

export default async function AdminDashboardPage() {
  const d = await getAdminDashboard();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Open reports" value={d.openReports} href="/admin/reports" />
        <Stat label="In review" value={d.reviewing} href="/admin/reports?status=REVIEWING" />
        <Stat label="ID checks pending" value={d.pendingIdChecks} />
        <Stat label="Active members" value={d.activeUsers} />
      </div>

      <Card>
        <CardTitle>Recent elevated safety events</CardTitle>
        <ul className="mt-3 divide-y divide-line text-sm">
          {d.recentEvents.length === 0 && (
            <li className="py-2 text-ink-faint">Nothing recent.</li>
          )}
          {d.recentEvents.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <Link href={`/admin/users/${e.userId}`} className="text-ink hover:text-glow">
                {e.type} · <span className="text-ink-faint">{e.severity}</span>
              </Link>
              <span className="text-xs text-ink-faint">{formatRelative(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <Card className="text-center">
      <p className="text-3xl font-display text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
