import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const staff = await requireRole("ADMIN", "MODERATOR");

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-line bg-paper-raised">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="font-display text-lg tracking-tight text-ink">
              Lunova · Trust &amp; Safety
            </Link>
            <nav className="flex gap-3 text-sm text-ink-soft">
              <Link href="/admin" className="hover:text-ink">Dashboard</Link>
              <Link href="/admin/reports" className="hover:text-ink">Reports</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span>{staff.email} · {staff.role}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
