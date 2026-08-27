import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import {
  decorateNotifications,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications/service";
import { EmptyState } from "@/components/ui/states";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notifications" };

const ICON: Record<string, string> = {
  NEW_MATCH: "✦",
  NEW_MESSAGE: "✉",
  NEW_LIKE: "♥",
  VERIFICATION_COMPLETE: "✓",
  VERIFICATION_REJECTED: "!",
  SECURITY_ALERT: "⚠",
  SAFETY_UPDATE: "shield",
  PRODUCT: "•",
};

export default async function NotificationsPage() {
  const user = await requireOnboardedUser();
  const items = await decorateNotifications(
    user.id,
    await listNotifications(user.id, { limit: 50 }),
  );
  // mark read on view
  await markNotificationsRead(user.id);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-display tracking-tight">Notifications</h1>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Matches, messages and likes will show up here."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-paper-raised">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5 hover:bg-sand/50",
                  !n.readAt && "bg-glow-soft/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-sand text-sm text-ink-soft"
                >
                  {ICON[n.type] ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{n.title}</p>
                  {n.body && (
                    <p className="truncate text-sm text-ink-soft">{n.body}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-faint">
                  {formatRelative(n.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
