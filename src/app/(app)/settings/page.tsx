import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: { id: true, userAgent: true, lastUsedAt: true, ip: true },
    take: 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display tracking-tight">Settings</h1>

      <Card>
        <CardTitle>Account</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Email</dt>
            <dd className="text-ink">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-faint">Email status</dt>
            <dd>
              <Badge tone={user.emailVerifiedAt ? "ok" : "warn"}>
                {user.emailVerifiedAt ? "Verified" : "Unverified"}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle>Active sessions</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Devices currently signed in to your account.
        </p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-ink">{labelUa(s.userAgent)}</span>
              <span className="text-ink-faint">
                {new Date(s.lastUsedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-faint">
          Full session management (revoke individually, sign out everywhere) lands
          with the privacy &amp; security phase.
        </p>
      </Card>

      <Card>
        <CardTitle>Session</CardTitle>
        <div className="mt-3">
          <LogoutButton className="text-glow hover:text-glow-press font-medium" />
        </div>
      </Card>
    </div>
  );
}

function labelUa(ua: string | null): string {
  if (!ua) return "Unknown device";
  const b = /Firefox/.test(ua)
    ? "Firefox"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Chrome/.test(ua)
        ? "Chrome"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const o = /Windows/.test(ua)
    ? "Windows"
    : /Mac/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "device";
  return `${b} · ${o}`;
}
