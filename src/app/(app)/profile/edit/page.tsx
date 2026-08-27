import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { ensureProfile } from "@/lib/profile/service";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import { StepMode } from "@/components/onboarding/step-form";
import { StepSection } from "@/components/onboarding/step-loaders";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Edit profile" };

const TITLES: Record<string, { title: string; blurb: string }> = {
  photos: { title: "Photos", blurb: "Your first photo is your main one." },
  basics: { title: "About you", blurb: "Name, gender, a short intro." },
  location: { title: "Location", blurb: "Used for distance only — never shown precisely." },
  intent: { title: "What you're looking for", blurb: "" },
  interests: { title: "Interests", blurb: "5–10 works best." },
  music: { title: "Music", blurb: "Artists and the mood." },
  activity: { title: "Movement", blurb: "How you like to move." },
  preferences: { title: "Discovery preferences", blurb: "Who gets shown to you." },
  privacy: { title: "Privacy", blurb: "What's visible, and to whom." },
};

export default async function EditProfilePage() {
  const user = await requireOnboardedUser();
  const profile = await ensureProfile(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display tracking-tight">Edit profile</h1>
        <Link href="/profile" className="text-sm text-ink-soft hover:text-ink">
          Done
        </Link>
      </div>

      <StepMode value="edit">
        {ONBOARDING_STEPS.map((s) => {
          const meta = TITLES[s.slug];
          return (
            <Card key={s.slug} id={s.slug} className="scroll-mt-20">
              <h2 className="text-lg font-display tracking-tight text-ink">{meta.title}</h2>
              {meta.blurb && (
                <p className="mt-0.5 mb-4 text-sm text-ink-soft">{meta.blurb}</p>
              )}
              <div className={meta.blurb ? "" : "mt-4"}>
                <StepSection slug={s.slug} userId={user.id} profileId={profile.id} />
              </div>
            </Card>
          );
        })}
      </StepMode>
    </div>
  );
}
