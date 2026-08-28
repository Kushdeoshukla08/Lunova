import { db } from "@/lib/db";
import { storage } from "@/lib/providers/storage";
import { KNOWN_CITIES } from "@/lib/providers/geocode";
import { PhotosStep } from "./photos-step";
import { BasicsStep } from "./basics-step";
import { LocationStep } from "./location-step";
import { IntentStep } from "./intent-step";
import { InterestsStep } from "./interests-step";
import { MusicStep } from "./music-step";
import { ActivityStep } from "./activity-step";
import { PreferencesStep } from "./preferences-step";
import { PrivacyStep } from "./privacy-step";

/**
 * Loads the data for one onboarding/profile section and renders its form.
 * Shared by /onboarding/[step] and /profile/edit — the StepForm inside reads
 * its mode ("onboarding" | "edit") from context.
 */
export async function StepSection({
  slug,
  userId,
  profileId,
}: {
  slug: string;
  userId: string;
  profileId: string;
}) {
  switch (slug) {
    case "photos": {
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
    case "basics": {
      const p = await db.profile.findUniqueOrThrow({
        where: { id: profileId },
        select: {
          displayName: true,
          gender: true,
          pronouns: true,
          orientation: true,
          bio: true,
          heightCm: true,
        },
      });
      return <BasicsStep defaults={p} />;
    }
    case "location": {
      const p = await db.profile.findUniqueOrThrow({
        where: { id: profileId },
        select: { city: true, locationPrecision: true },
      });
      return <LocationStep knownCities={KNOWN_CITIES} defaults={p} />;
    }
    case "intent": {
      const p = await db.profile.findUniqueOrThrow({
        where: { id: profileId },
        select: { relationshipIntent: true },
      });
      return <IntentStep defaultValue={p.relationshipIntent} />;
    }
    case "interests": {
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
    case "music": {
      const music = await db.musicProfile.findUnique({
        where: { profileId },
        select: {
          listeningMood: true,
          topGenres: true,
          artists: { orderBy: { rank: "asc" }, select: { artist: { select: { name: true } } } },
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
    case "activity": {
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
    case "preferences": {
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
    case "privacy": {
      const privacy = await db.privacySetting.findUnique({ where: { userId } });
      return (
        <PrivacyStep
          defaults={{
            musicVisibility: privacy?.musicVisibility ?? "PUBLIC",
            activityVisibility: privacy?.activityVisibility ?? "CONNECTIONS",
            incognito: privacy?.incognito ?? false,
          }}
        />
      );
    }
    default:
      return null;
  }
}
