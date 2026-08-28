import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata: Metadata = { title: "Settings" };

const LINKS = [
  ["/settings/notifications", "Notifications", "What we tell you about, and how"],
  ["/settings/privacy", "Privacy & visibility", "Who sees your profile, music, activity and distance"],
  ["/settings/security", "Security", "Signed-in devices and sessions"],
  ["/settings/language", "Language & region", "Display language, and how dates and distances are shown"],
  ["/settings/blocked", "Blocked people", "Manage who you've blocked"],
  ["/settings/account", "Account", "Export or delete your data"],
];

export default async function SettingsPage() {
  const user = await requireUser();
  const trust = await db.trustProfile.findUnique({
    where: { userId: user.id },
    select: { phoneVerified: true, photoVerified: true, identityVerified: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display tracking-tight">Settings</h1>

      <Card>
        <CardTitle>Account</CardTitle>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Email">
            <span className="text-ink">{user.email}</span>
            <Badge tone={user.emailVerifiedAt ? "ok" : "warn"} className="ml-2">
              {user.emailVerifiedAt ? "Verified" : "Unverified"}
            </Badge>
          </Row>
          <Row label="Phone">
            {trust?.phoneVerified ? (
              <Badge tone="ok">Verified</Badge>
            ) : (
              <Link href="/verify/phone" className="text-glow hover:text-glow-press">
                Add & verify
              </Link>
            )}
          </Row>
          <Row label="Photo verification">
            {trust?.photoVerified ? (
              <Badge tone="moonlight">Verified</Badge>
            ) : (
              <Link href="/verify/photo" className="text-glow hover:text-glow-press">
                Get verified
              </Link>
            )}
          </Row>
        </dl>
      </Card>

      <Card padding="none">
        <ul className="divide-y divide-line">
          {LINKS.map(([href, title, blurb]) => (
            <li key={href}>
              <Link href={href} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sand/50">
                <div>
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="text-xs text-ink-soft">{blurb}</p>
                </div>
                <span className="text-ink-faint">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Session</CardTitle>
        <div className="mt-3">
          <LogoutButton className="font-medium text-glow hover:text-glow-press" />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}
