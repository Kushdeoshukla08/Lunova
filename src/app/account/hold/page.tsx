import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { LogoutButton } from "@/components/auth/logout-button";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Account on hold" };

export default async function AccountHoldPage() {
  const user = await requireUser();
  const banned = user.status === "BANNED";

  return (
    <div className="aurora flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <LogoutButton />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="surface-card w-full max-w-md p-8 text-center">
          <h1 className="text-2xl font-display tracking-tight">
            {banned ? "This account is closed" : "Your account is on hold"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft text-pretty">
            {banned
              ? "After review, this account was found to be in serious breach of our community rules and has been permanently closed."
              : "Our safety team is reviewing recent activity on your account. This usually resolves within a few days. You'll get an email when it's done."}
          </p>
          <p className="mt-4 text-sm text-ink-soft">
            Think this is a mistake?{" "}
            <a href="/appeal" className="font-medium text-glow hover:text-glow-press">
              Request a review
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
