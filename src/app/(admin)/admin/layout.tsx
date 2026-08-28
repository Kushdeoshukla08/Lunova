import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const staff = await requireRole("ADMIN", "MODERATOR");

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-line bg-paper-raised">
        {/* Moderators do open this on a phone. Everything wraps and the staff
            address truncates, so the header never forces a horizontal scroll. */}
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/admin" className="font-display text-lg tracking-tight text-ink">
              Lunova · Trust &amp; Safety
            </Link>
            <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
              <Link href="/admin" className="tap-target hover:text-ink">Dashboard</Link>
              <Link href="/admin/reports" className="tap-target hover:text-ink">Reports</Link>
              <Link href="/admin/metrics" className="tap-target hover:text-ink">Product health</Link>
              <Link href="/admin/why" className="tap-target hover:text-ink">Why this person</Link>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-xs text-ink-faint">
            <span className="truncate" title={staff.email}>
              {staff.email} · {staff.role}
            </span>
            <LogoutButton className="shrink-0" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
