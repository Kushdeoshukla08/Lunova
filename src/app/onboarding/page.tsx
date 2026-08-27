import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Set up your profile" };

/**
 * Placeholder — the real progressive onboarding flow is the next phase.
 * `requireUser` (not `requireOnboardedUser`) so PENDING accounts can reach it.
 */
export default async function OnboardingPage() {
  const user = await requireUser();

  return (
    <div className="aurora flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <LogoutButton />
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
        <div className="surface-card p-8">
          <Badge tone={user.emailVerifiedAt ? "ok" : "warn"}>
            {user.emailVerifiedAt ? "Email verified" : "Email not verified"}
          </Badge>
          <h1 className="mt-3 text-2xl font-display tracking-tight">
            You&apos;re in, {user.email.split("@")[0]}.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft text-pretty">
            Onboarding — photos, a couple of prompts, your music and the way you
            move — is the next build phase. Your account, session, verification
            and safety records are all live.
          </p>
        </div>
      </main>
    </div>
  );
}
