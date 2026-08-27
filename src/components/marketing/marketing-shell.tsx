import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Join Lunova
          </Link>
        </nav>
      </header>
      <main id="content" className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8 sm:py-16">
        {children}
      </main>
      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-8 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark />
          <p>© {new Date().getFullYear()} Lunova · A calmer way to meet people</p>
          <nav className="flex gap-4 text-ink-soft">
            <Link href="/safety" className="hover:text-ink">Safety</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Simple prose wrapper for policy pages. */
export function Prose({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-display tracking-tight">{title}</h1>
        {updated && <p className="mt-1 text-sm text-ink-faint">Last updated {updated}</p>}
      </header>
      <div className="flex flex-col gap-4 text-[0.95rem] leading-relaxed text-ink-soft [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-display [&_h2]:text-ink [&_strong]:text-ink [&_a]:text-glow hover:[&_a]:text-glow-press [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}
