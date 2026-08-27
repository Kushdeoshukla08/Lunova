import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { ONBOARDING_STEPS, stepIndex, TOTAL_STEPS } from "@/lib/onboarding/steps";

export function OnboardingScaffold({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const i = stepIndex(slug);
  const meta = ONBOARDING_STEPS[i];
  const prev = i > 0 ? ONBOARDING_STEPS[i - 1].slug : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-ink-faint">
          <span>
            Step {i + 1} of {TOTAL_STEPS}
          </span>
          {prev && (
            <Link href={`/onboarding/${prev}`} className="hover:text-ink">
              ← Back
            </Link>
          )}
        </div>
        <Progress value={i} max={TOTAL_STEPS} label="Onboarding progress" />
      </div>

      <div>
        <h1 className="text-2xl font-display tracking-tight">{meta.title}</h1>
        <p className="mt-1 text-sm text-ink-soft text-pretty">{meta.subtitle}</p>
      </div>

      <div className="surface-card p-5 sm:p-6">{children}</div>
    </div>
  );
}
