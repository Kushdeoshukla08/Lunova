"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { LunovaMark } from "@/components/brand/wordmark";
import type { CurrentUser } from "@/lib/auth/dal";

export type NavLabels = {
  discover: string;
  connections: string;
  activity: string;
  profile: string;
  notifications: string;
  settings: string;
};

const DEFAULT_LABELS: NavLabels = {
  discover: "Discover",
  connections: "Connections",
  activity: "Activity",
  profile: "Profile",
  notifications: "Notifications",
  settings: "Settings",
};

type NavKey = "discover" | "connections" | "activity" | "profile";
type NavItem = { href: string; key: NavKey; icon: React.ReactNode };

const NAV: NavItem[] = [
  { href: "/discover", key: "discover", icon: <IconCompass /> },
  { href: "/connections", key: "connections", icon: <IconSpark /> },
  { href: "/activity", key: "activity", icon: <IconPulse /> },
  { href: "/profile", key: "profile", icon: <IconPerson /> },
];

export function AppShell({
  user,
  children,
  labels = DEFAULT_LABELS,
  unreadConnections = 0,
  unreadNotifications = 0,
}: {
  user: CurrentUser;
  children: React.ReactNode;
  labels?: NavLabels;
  unreadConnections?: number;
  unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const badgeFor = (href: string) =>
    href === "/connections" && unreadConnections > 0 ? unreadConnections : null;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-paper-raised px-3 py-5 lg:flex">
        <Link
          href="/discover"
          className="mb-6 flex items-center gap-2 px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow rounded-md"
        >
          <LunovaMark className="size-6" />
          <span className="font-display text-xl tracking-tight text-ink">Lunova</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-sand text-ink"
                  : "text-ink-soft hover:bg-sand/60 hover:text-ink",
              )}
            >
              <span className="[&_svg]:size-5">{item.icon}</span>
              {labels[item.key]}
              {badgeFor(item.href) && (
                <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-glow px-1.5 text-xs font-medium text-white">
                  {badgeFor(item.href)}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <Link
          href="/notifications"
          aria-current={isActive("/notifications") ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
            isActive("/notifications")
              ? "bg-sand text-ink"
              : "text-ink-soft hover:bg-sand/60 hover:text-ink",
          )}
        >
          <span className="[&_svg]:size-5"><IconBell /></span>
          {labels.notifications}
          {unreadNotifications > 0 && (
            <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-glow px-1.5 text-xs font-medium text-white">
              {unreadNotifications}
            </span>
          )}
        </Link>
        <Link
          href="/settings"
          className="mt-1 flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-ink-soft hover:bg-sand/60 hover:text-ink"
        >
          <Avatar name={user.displayName ?? user.email} size="xs" />
          <span className="truncate">{user.displayName ?? labels.settings}</span>
        </Link>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper-raised/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/discover" className="flex items-center gap-2">
          <LunovaMark className="size-6" />
          <span className="font-display text-lg tracking-tight text-ink">Lunova</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}
            className="relative grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sand"
          >
            <span className="[&_svg]:size-5"><IconBell /></span>
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-glow" />
            )}
          </Link>
          <Link href="/settings" aria-label="Settings">
            <Avatar name={user.displayName ?? user.email} size="sm" />
          </Link>
        </div>
      </header>

      {/* Content */}
      {/* The bottom padding clears the fixed nav *and* the home indicator; both
          have to grow together or the last row of content ends up under one. */}
      <main
        id="content"
        className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0"
      >
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:max-w-4xl lg:py-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium",
              isActive(item.href) ? "text-glow" : "text-ink-faint",
            )}
          >
            <span className="[&_svg]:size-6">{item.icon}</span>
            {labels[item.key]}
            {badgeFor(item.href) && (
              <span className="absolute right-[calc(50%-1.75rem)] top-1.5 grid min-w-4 place-items-center rounded-full bg-glow px-1 text-[0.6rem] font-semibold text-white">
                {badgeFor(item.href)}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function IconCompass() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m15.5 8.5-2 5-5 2 2-5 5-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c.6 3.6 1.8 4.8 5.4 5.4-3.6.6-4.8 1.8-5.4 5.4-.6-3.6-1.8-4.8-5.4-5.4C10.2 7.8 11.4 6.6 12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M18 14c.3 1.8.9 2.4 2.7 2.7-1.8.3-2.4.9-2.7 2.7-.3-1.8-.9-2.4-2.7-2.7 1.8-.3 2.4-.9 2.7-2.7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h4l2-6 4 12 2-6h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
