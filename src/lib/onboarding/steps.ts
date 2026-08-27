export const ONBOARDING_STEPS = [
  { slug: "photos", title: "Add a few photos", subtitle: "At least one. Clear, recent, and actually you." },
  { slug: "basics", title: "The basics", subtitle: "Your name and how you'd like to be seen." },
  { slug: "location", title: "Where you're based", subtitle: "Used for distance only — never shown precisely." },
  { slug: "intent", title: "What you're looking for", subtitle: "Be honest — it helps you meet the right people." },
  { slug: "interests", title: "A few interests", subtitle: "Pick 5–10. These become conversation openers." },
  { slug: "music", title: "Your music", subtitle: "The artists and the mood — an identity layer." },
  { slug: "activity", title: "How you move", subtitle: "Lifestyle rhythm, not a fitness score." },
  { slug: "preferences", title: "Who to show you", subtitle: "Age, distance, and who you're open to." },
  { slug: "privacy", title: "Privacy & finish", subtitle: "You control what's visible. Change any of this later." },
] as const;

export type OnboardingSlug = (typeof ONBOARDING_STEPS)[number]["slug"];

export const FIRST_STEP: OnboardingSlug = ONBOARDING_STEPS[0].slug;

export function stepIndex(slug: string): number {
  return ONBOARDING_STEPS.findIndex((s) => s.slug === slug);
}

export function stepMeta(slug: string) {
  return ONBOARDING_STEPS.find((s) => s.slug === slug) ?? null;
}

/** The slug after `slug`, or null if `slug` is the last step. */
export function nextStep(slug: string): OnboardingSlug | null {
  const i = stepIndex(slug);
  return i >= 0 && i < ONBOARDING_STEPS.length - 1
    ? ONBOARDING_STEPS[i + 1].slug
    : null;
}

export function isOnboardingSlug(v: string): v is OnboardingSlug {
  return stepIndex(v) >= 0;
}

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
