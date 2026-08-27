import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyPage() {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect("/onboarding");

  const masked = user.email.replace(/^(.).*(@.*)$/, "$1•••$2");

  return (
    <div className="surface-card p-6 sm:p-8">
      <h1 className="text-2xl font-display tracking-tight">Check your email</h1>
      <p className="mt-1 text-sm text-ink-soft">
        We sent a 6-digit code to <span className="text-ink">{masked}</span>. It
        expires in 15 minutes.
      </p>
      <p className="mt-2 rounded-[var(--radius-sm)] bg-sand px-3 py-2 text-xs text-ink-faint">
        Dev mode: the code is printed in the server console (no real email is sent).
      </p>
      <div className="mt-6">
        <VerifyForm />
      </div>
    </div>
  );
}
