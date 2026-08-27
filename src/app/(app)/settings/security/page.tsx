import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { signOutEverywhereAction } from "@/lib/settings/actions";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { SessionRow } from "@/components/settings/session-row";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Security" };

function labelUa(ua: string | null): string {
  if (!ua) return "Unknown device";
  const b = /Firefox/.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Browser";
  const o = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "device";
  return `${b} · ${o}`;
}

export default async function SecuritySettingsPage() {
  const user = await requireUser();
  const [sessions, current] = await Promise.all([
    db.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, userAgent: true, lastUsedAt: true },
    }),
    readSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title="Security"
        subtitle="Every device currently signed in to your account."
      />

      <Card>
        <CardTitle>Active sessions</CardTitle>
        <div className="mt-2 divide-y divide-line">
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              id={s.id}
              label={labelUa(s.userAgent)}
              lastUsed={formatRelative(s.lastUsedAt)}
              current={s.id === current?.id}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Sign out everywhere</CardTitle>
        <p className="mt-1 text-sm text-ink-soft">
          Ends every session, including this one. Use this if you think someone
          else has access.
        </p>
        <form action={signOutEverywhereAction} className="mt-3">
          <Button type="submit" variant="danger" size="sm">
            Sign out of all devices
          </Button>
        </form>
      </Card>
    </div>
  );
}
