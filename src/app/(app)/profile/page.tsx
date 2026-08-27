import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ActionToggle } from "@/components/ui/toggle";
import { setDiscoveryPausedAction, setIncognitoAction } from "@/lib/profile/actions";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "Your profile" };

const SECTION_LABEL: Record<string, string> = {
  photos: "Photos",
  basics: "About you",
  location: "Location",
  intent: "What you're looking for",
  interests: "Interests",
  music: "Music",
  activity: "Movement",
  preferences: "Discovery preferences",
  privacy: "Privacy",
};

export default async function ProfilePage() {
  const user = await requireOnboardedUser();
  const [profile, privacy] = await Promise.all([
    db.profile.findUnique({
      where: { userId: user.id },
      select: {
        displayName: true,
        completeness: true,
        _count: { select: { photos: true, prompts: true, interests: true } },
      },
    }),
    db.privacySetting.findUnique({
      where: { userId: user.id },
      select: { discoveryPaused: true, incognito: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.displayName ?? user.email} src={user.primaryPhotoUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-display tracking-tight">
            {profile?.displayName || "Your profile"}
          </h1>
          <p className="text-sm text-ink-soft">This is how you show up on Lunova.</p>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Profile strength</CardTitle>
          <span className="text-sm text-ink-soft">{profile?.completeness ?? 0}%</span>
        </div>
        <Progress value={profile?.completeness ?? 0} className="mt-3" label="Profile strength" />
        <p className="mt-2 text-xs text-ink-faint">
          {(profile?._count.photos ?? 0) < 3
            ? "Add a third photo — profiles with more photos get seen more."
            : (profile?._count.prompts ?? 0) < 3
              ? "Answer one more prompt to give people something to open with."
              : "Looking good. Keep it fresh."}
        </p>
        <Link
          href="/profile/edit"
          className={buttonVariants({ size: "sm", className: "mt-4" })}
        >
          Edit profile
        </Link>
      </Card>

      <Card>
        <CardTitle>Sections</CardTitle>
        <ul className="mt-2 divide-y divide-line">
          {ONBOARDING_STEPS.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/profile/edit#${s.slug}`}
                className="flex items-center justify-between py-3 text-sm hover:text-glow"
              >
                <span className="text-ink">{SECTION_LABEL[s.slug] ?? s.slug}</span>
                <span className="text-ink-faint">Edit →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Availability</CardTitle>
        <div className="mt-1 divide-y divide-line">
          <ActionToggle
            initial={privacy?.discoveryPaused ?? false}
            action={setDiscoveryPausedAction}
            label="Pause discovery"
            description="You won't be shown to new people. Existing conversations keep working."
          />
          <ActionToggle
            initial={privacy?.incognito ?? false}
            action={setIncognitoAction}
            label="Incognito"
            description="Only people you've already liked can see your profile."
          />
        </div>
      </Card>

      <p className="text-center text-sm">
        <Link href="/settings" className="text-ink-soft hover:text-ink">
          Account & settings
        </Link>
      </p>

      {(profile?._count.photos ?? 0) === 0 && (
        <Badge tone="warn">Add at least one photo to appear in Discover</Badge>
      )}
    </div>
  );
}
