import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { ensureProfile } from "@/lib/profile/service";
import { FIRST_STEP } from "@/lib/onboarding/steps";

export default async function OnboardingIndex() {
  const user = await requireUser();
  if (user.onboardingComplete) redirect("/discover");
  const profile = await ensureProfile(user.id);
  redirect(`/onboarding/${profile.onboardingStep ?? FIRST_STEP}`);
}
