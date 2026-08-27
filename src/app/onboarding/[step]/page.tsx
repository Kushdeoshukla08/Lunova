import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ensureProfile } from "@/lib/profile/service";
import { storage } from "@/lib/providers/storage";
import { KNOWN_CITIES } from "@/lib/providers/geocode";
import {
  isOnboardingSlug,
  stepIndex,
  stepMeta,
} from "@/lib/onboarding/steps";
import { OnboardingScaffold } from "@/components/onboarding/scaffold";
import { PhotosStep } from "@/components/onboarding/photos-step";
import { BasicsStep } from "@/components/onboarding/basics-step";
import { LocationStep } from "@/components/onboarding/location-step";
import { IntentStep } from "@/components/onboarding/intent-step";
import { InterestsStep } from "@/components/onboarding/interests-step";
import { MusicStep } from "@/components/onboarding/music-step";
import { ActivityStep } from "@/components/onboarding/activity-step";
import { PreferencesStep } from "@/components/onboarding/preferences-step";
import { PrivacyStep } from "@/components/onboarding/privacy-step";

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
      {step === "photos" && <PhotosStepData profileId={profile.id} />}
      {step === "basics" && (
        <BasicsStep
          defaults={{
            displayName: profile.displayName,
            gender: profile.gender,
            pronouns: profile.pronouns,
            orientation: profile.orientation,
            bio: profile.bio,
            heightCm: profile.heightCm,
          }}
        />
      )}
      {step === "location" && (
        <LocationStep
          knownCities={KNOWN_CITIES}
          defaults={{
            city: profile.city,
            locationPrecision: profile.locationPrecision,
          }}
        />
      )}
      {step === "intent" && (
        <IntentStep defaultValue={profile.relationshipIntent} />
      )}
      {step === "interests" && <InterestsStepData profileId={profile.id} />}
      {step === "music" && <MusicStepData profileId={profile.id} />}
      {step === "activity" && <ActivityStepData profileId={profile.id} />}
      {step === "preferences" && <PreferencesStepData userId={user.id} />}
      {step === "privacy" && <PrivacyStepData userId={user.id} />}
    </OnboardingScaffold>
  );
}

async function PhotosStepData({ profileId }: { profileId: string }) {
  const photos = await db.photo.findMany({
    where: { profileId },
    orderBy: { position: "asc" },
    select: { id: true, storageKey: true, isPrimary: true, moderationStatus: true },
  });
  return (
    <PhotosStep
      photos={photos.map((p) => ({
        id: p.id,
        url: storage.publicUrl(p.storageKey),
        isPrimary: p.isPrimary,
        pending: p.moderationStatus === "PENDING",
      }))}
    />
  );
}

async function InterestsStepData({ profileId }: { profileId: string }) {
  const [all, mine] = await Promise.all([
    db.interest.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] }),
    db.profileInterest.findMany({
      where: { profileId },
      select: { interest: { select: { slug: true } } },
    }),
  ]);
  return (
    <InterestsStep
      options={all.map((i) => ({ slug: i.slug, label: i.label, category: i.category }))}
      selected={mine.map((m) => m.interest.slug)}
    />
  );
}

async function MusicStepData({ profileId }: { profileId: string }) {
  const music = await db.musicProfile.findUnique({
    where: { profileId },
    select: {
      listeningMood: true,
      topGenres: true,
      artists: {
        orderBy: { rank: "asc" },
        select: { artist: { select: { name: true } } },
      },
    },
  });
  return (
    <MusicStep
      defaults={{
        listeningMood: music?.listeningMood ?? "",
        topGenres: music?.topGenres ?? [],
        artists: music?.artists.map((a) => a.artist.name) ?? [],
      }}
    />
  );
}

async function ActivityStepData({ profileId }: { profileId: string }) {
  const [all, activity] = await Promise.all([
    db.activityType.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] }),
    db.activityProfile.findUnique({
      where: { profileId },
      select: {
        preferredLifestyle: true,
        activeDaysPerWeek: true,
        types: { select: { activityType: { select: { slug: true } } } },
      },
    }),
  ]);
  return (
    <ActivityStep
      options={all.map((t) => ({ slug: t.slug, label: t.label, category: t.category }))}
      defaults={{
        preferredLifestyle: activity?.preferredLifestyle ?? "",
        activeDaysPerWeek: activity?.activeDaysPerWeek ?? null,
        types: activity?.types.map((t) => t.activityType.slug) ?? [],
      }}
    />
  );
}

async function PreferencesStepData({ userId }: { userId: string }) {
  const pref = await db.preference.findUnique({ where: { userId } });
  return (
    <PreferencesStep
      defaults={{
        minAge: pref?.minAge ?? 25,
        maxAge: pref?.maxAge ?? 40,
        maxDistanceKm: pref?.maxDistanceKm ?? 50,
        genders: pref?.genders ?? [],
        globalMode: pref?.globalMode ?? false,
      }}
    />
  );
}

async function PrivacyStepData({ userId }: { userId: string }) {
  const privacy = await db.privacySetting.findUnique({ where: { userId } });
  return (
    <PrivacyStep
      defaults={{
        musicVisibility: privacy?.musicVisibility ?? "PUBLIC",
        activityVisibility: privacy?.activityVisibility ?? "CONNECTIONS",
        showActiveStatus: privacy?.showActiveStatus ?? true,
        incognito: privacy?.incognito ?? false,
      }}
    />
  );
}
