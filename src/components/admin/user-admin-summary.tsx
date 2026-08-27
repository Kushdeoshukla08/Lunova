import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelative } from "@/lib/format";
import { REPORT_CATEGORY_LABELS } from "@/lib/enums/labels";
import type { getUserAdminView } from "@/lib/admin/service";

type View = NonNullable<Awaited<ReturnType<typeof getUserAdminView>>>;

export function UserAdminSummary({ view }: { view: View }) {
  const { user, reportsAbout, reportsBy, moderation, events } = view;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>
              <Link href={`/admin/users/${user.id}`} className="hover:text-glow">
                {user.profile?.displayName ?? "No profile"}
              </Link>
            </CardTitle>
            <p className="mt-0.5 text-sm text-ink-soft">{user.email}</p>
          </div>
          <Badge tone={user.status === "ACTIVE" ? "ok" : "warn"}>{user.status}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <Meta k="Role" v={user.role} />
          <Meta k="Joined" v={formatRelative(user.createdAt)} />
          <Meta k="Last active" v={formatRelative(user.lastActiveAt)} />
          <Meta k="Location" v={[user.profile?.city, user.profile?.country].filter(Boolean).join(", ") || "—"} />
          <Meta k="Email verified" v={user.emailVerifiedAt ? "yes" : "no"} />
          <Meta k="Phone verified" v={user.phoneVerifiedAt ? "yes" : "no"} />
          <Meta k="Trust tier" v={user.trust?.tier ?? "—"} />
          <Meta k="Strikes" v={String(user.trust?.moderationStrikes ?? 0)} />
          <Meta k="Reports received" v={String(user.trust?.reportsReceived ?? 0)} />
          <Meta k="Reports made" v={String(reportsBy)} />
        </dl>
        {user.photos.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {user.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.url}
                alt=""
                className="size-20 shrink-0 rounded-[var(--radius-sm)] object-cover"
              />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Moderation history</CardTitle>
          <ul className="mt-2 divide-y divide-line text-sm">
            {moderation.length === 0 && <li className="py-2 text-ink-faint">None</li>}
            {moderation.map((m) => (
              <li key={m.id} className="py-2">
                <span className="font-medium text-ink">{m.action}</span>
                <span className="text-ink-faint"> · {formatRelative(m.createdAt)}</span>
                <p className="text-ink-soft">{m.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Reports about this member</CardTitle>
          <ul className="mt-2 divide-y divide-line text-sm">
            {reportsAbout.length === 0 && <li className="py-2 text-ink-faint">None</li>}
            {reportsAbout.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link href={`/admin/reports/${r.id}`} className="text-ink hover:text-glow">
                  {REPORT_CATEGORY_LABELS[r.category] ?? r.category}
                </Link>
                <Badge tone="neutral">{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Safety events</CardTitle>
        <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-line text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-1.5">
              <span className="text-ink">
                {e.type} <span className="text-ink-faint">· {e.source}</span>
              </span>
              <span className="text-xs text-ink-faint">
                {e.severity} · {formatRelative(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-ink-faint">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </>
  );
}
