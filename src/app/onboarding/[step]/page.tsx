import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ensureProfile } from "@/lib/profile/service";
import { isOnboardingSlug, stepIndex, stepMeta } from "@/lib/onboarding/steps";
import { OnboardingScaffold } from "@/components/onboarding/scaffold";
import { StepSection } from "@/components/onboarding/step-loaders";

export async function generateMetadata(
  props: PageProps<"/onboarding/[step]">,
): Promise<Metadata> {
  const { step } = await props.params;
  return { title: stepMeta(step)?.title ?? "Onboarding" };
}

export default async function OnboardingStepPage(
  props: PageProps<"/onboarding/[step]">,
) {
  const { step } = await props.params;
  if (!isOnboardingSlug(step)) notFound();

  const user = await requireUser();
  if (user.onboardingComplete) redirect("/discover");
  const profile = await ensureProfile(user.id);

  // Ordering guard — can't skip ahead of the resume pointer.
  if (
    profile.onboardingStep &&
    stepIndex(step) > stepIndex(profile.onboardingStep)
  ) {
    redirect(`/onboarding/${profile.onboardingStep}`);
  }

  return (
    <OnboardingScaffold slug={step}>
      <StepSection slug={step} userId={user.id} profileId={profile.id} />
    </OnboardingScaffold>
  );
}
