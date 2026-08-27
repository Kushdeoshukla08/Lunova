import Link from "next/link";
import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/button";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "@/components/brand/wordmark";

export const metadata: Metadata = {
  title: "Lunova — meet people through how you live",
};

const pillars = [
  {
    k: "Identity",
    t: "Who you are",
    d: "A few real prompts, not a personality quiz. Enough to feel like a person, not a résumé.",
  },
  {
    k: "Music",
    t: "What you listen to",
    d: "Your artists and the mood you play them in — an identity layer, not a separate app.",
  },
  {
    k: "Movement",
    t: "How you live",
    d: "Walks, climbs, run clubs, slow Sundays. Lifestyle rhythm, never a fitness leaderboard.",
  },
];

const steps = [
  ["Build your profile", "Photos, a couple of prompts, your music and the way you move."],
  ["Discover people", "Each profile reads at a glance — and shows why you might connect."],
  ["Say something real", "React to a song or a prompt, not just a photo. Then match."],
  ["Take it from there", "A clean conversation with a reason to start it."],
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            Join Lunova
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="aurora relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="flex flex-col items-start gap-6">
            <Badge tone="outline">Lifestyle-first connection</Badge>
            <h1 className="text-4xl font-display leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl lg:text-[3.5rem]">
              Meet people through{" "}
              <span className="italic text-glow">how you live</span>.
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-ink-soft text-pretty">
              Lunova helps you discover meaningful connections through who you
              are, what you enjoy, what you listen to, and how you move through
              your days.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Create your profile
              </Link>
              <Link
                href="#how"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                How it works
              </Link>
            </div>
            <p className="text-xs text-ink-faint">
              18+ · Verify your photos · Block and report on every screen
            </p>
          </div>

          <ProfilePreview />
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="max-w-xl text-2xl font-display tracking-tight text-ink sm:text-3xl">
          One profile. The parts of you that actually make a connection.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.k}
              className="surface-card flex flex-col gap-2 p-6"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                {p.k}
              </span>
              <h3 className="text-lg font-display text-ink">{p.t}</h3>
              <p className="text-sm leading-relaxed text-ink-soft text-pretty">
                {p.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-sand/50 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <h2 className="text-2xl font-display tracking-tight text-ink sm:text-3xl">
            The loop is short on purpose
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex flex-col gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-medium text-paper">
                  {i + 1}
                </span>
                <h3 className="text-base font-medium text-ink">{t}</h3>
                <p className="text-sm leading-relaxed text-ink-soft text-pretty">
                  {d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="surface-card grid gap-8 p-8 sm:p-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-display tracking-tight text-ink sm:text-3xl text-balance">
              Safety isn&apos;t a setting. It&apos;s the foundation.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft text-pretty">
              Verification, private trust signals, and privacy-aware location are
              built into the architecture — not bolted on. Safety features are
              never behind a paywall.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Photo and identity verification",
              "Approximate distance only — never your exact location",
              "You control who sees your music and movement",
              "Block, report, unmatch on every screen",
              "Reports go to a real moderation queue",
              "No public scores, no shame mechanics",
            ].map((s) => (
              <li
                key={s}
                className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-glow" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark />
          <p className="text-xs text-ink-faint">
            © {new Date().getFullYear()} Lunova · A calmer way to meet people
          </p>
          <nav className="flex gap-4 text-xs text-ink-soft">
            <Link href="/safety" className="hover:text-ink">
              Safety
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/styleguide" className="hover:text-ink">
              Style guide
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Illustrative preview of a discovery card — static, no data. */
function ProfilePreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="surface-card overflow-hidden rounded-[var(--radius-xl)]">
        <div className="relative aspect-[4/5] bg-gradient-to-br from-glow-soft via-sand to-moonlight-soft">
          <div className="absolute left-4 top-4">
            <VerifiedBadge />
          </div>
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
            <div className="text-ink">
              <p className="font-display text-2xl leading-none">Maya, 29</p>
              <p className="text-sm text-ink-soft">Lisbon · 4 km away</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <p className="text-sm leading-relaxed text-ink text-pretty">
            <span className="text-ink-faint">A perfect Sunday looks like… </span>
            tide pools before the crowds, then bread and nothing planned.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="moonlight">🎧 3 shared artists</Badge>
            <Badge tone="glow">🥾 You both hike</Badge>
            <Badge>Long-term</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
