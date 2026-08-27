import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboardingComplete ? "/discover" : "/onboarding");

  return (
    <div className="surface-card p-6 sm:p-8">
      <h1 className="text-2xl font-display tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-soft">
        A calmer way to meet people — start with the basics.
      </p>
      <div className="mt-6">
        <SignUpForm />
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        Already on Lunova?{" "}
        <Link href="/login" className="font-medium text-glow hover:text-glow-press">
          Sign in
        </Link>
      </p>
    </div>
  );
}
