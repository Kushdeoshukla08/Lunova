import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { LogInForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LogInPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingComplete ? "/discover" : "/onboarding");

  return (
    <div className="surface-card p-6 sm:p-8">
      <h1 className="text-2xl font-display tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-soft">Sign in to pick up where you left off.</p>
      <div className="mt-6">
        <LogInForm />
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-medium text-glow hover:text-glow-press">
          Create an account
        </Link>
      </p>
    </div>
  );
}
