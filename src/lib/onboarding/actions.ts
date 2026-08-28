"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { ensureProfile, recomputeCompleteness } from "@/lib/profile/service";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  storage,
} from "@/lib/providers/storage";
import { geocode } from "@/lib/providers/geocode";
import { moderateImage } from "@/lib/moderation/provider";
import { screenProfileText } from "@/lib/profile/moderation";
import {
  isOnboardingSlug,
  nextStep,
  stepIndex,
  type OnboardingSlug,
} from "@/lib/onboarding/steps";
import {
  activitySchema,
  basicsSchema,
  intentSchema,
  interestsSchema,
  locationSchema,
  musicSchema,
  preferencesSchema,
  privacySchema,
} from "@/lib/validation/onboarding";

export type StepState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Set after a successful save in "edit" mode (no redirect). */
  saved?: boolean;
  /** The values actually written, read back from the DB. Lets the client trust the response. */
  persisted?: Record<string, unknown>;
};

export type StepMode = "onboarding" | "edit";

const MAX_PHOTOS = 6;

async function currentProfile() {
  const user = await requireUser();
  const profile = await ensureProfile(user.id);
  return { user, profile };
}

/** Don't let a later step be saved before earlier ones are done. */
function assertStepAllowed(profileStep: string | null, target: OnboardingSlug) {
  if (profileStep === null) return; // already onboarded — re-editing is fine
  if (stepIndex(target) > stepIndex(profileStep)) {
    redirect(`/onboarding/${profileStep}`);
  }
}

// ─── Photos ──────────────────────────────────────────────────────────────────

export async function uploadPhotoAction(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const { profile } = await currentProfile();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Use a JPEG, PNG, WebP or AVIF image." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "That image is over 8 MB — try a smaller one." };
  }
  const count = await db.photo.count({ where: { profileId: profile.id } });
  if (count >= MAX_PHOTOS) {
    return { error: `You can add up to ${MAX_PHOTOS} photos.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const verdict = await moderateImage(bytes, file.type);
  if (verdict.action === "reject") {
    return { error: "That image didn't pass our content check. Try another." };
  }

  const { key } = await storage.put("photos", bytes, file.type);
  await db.photo.create({
    data: {
      profileId: profile.id,
      storageKey: key,
      position: count,
      isPrimary: count === 0,
      moderationStatus: verdict.action === "allow" ? "APPROVED" : "PENDING",
      moderationLabels: verdict.labels as object,
    },
  });
  revalidatePath("/onboarding/photos");
  return {};
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const { profile } = await currentProfile();
  const id = String(formData.get("photoId") ?? "");
  const photo = await db.photo.findFirst({
    where: { id, profileId: profile.id },
  });
  if (!photo) return;
  await db.photo.delete({ where: { id: photo.id } });
  await storage.delete(photo.storageKey);
  // keep positions tidy and ensure a primary exists
  const rest = await db.photo.findMany({
    where: { profileId: profile.id },
    orderBy: { position: "asc" },
  });
  await Promise.all(
    rest.map((p, i) =>
      db.photo.update({
        where: { id: p.id },
        data: { position: i, isPrimary: i === 0 },
      }),
    ),
  );
  revalidatePath("/onboarding/photos");
}

export async function setPrimaryPhotoAction(formData: FormData): Promise<void> {
  const { profile } = await currentProfile();
  const id = String(formData.get("photoId") ?? "");
  const photo = await db.photo.findFirst({ where: { id, profileId: profile.id } });
  if (!photo) return;
  await db.$transaction([
    db.photo.updateMany({
      where: { profileId: profile.id },
      data: { isPrimary: false },
    }),
    db.photo.update({ where: { id: photo.id }, data: { isPrimary: true } }),
  ]);
  revalidatePath("/onboarding/photos");
}

// ─── Step save (dispatch by slug) ────────────────────────────────────────────

export async function saveStepAction(
  slug: string,
  mode: StepMode,
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  if (!isOnboardingSlug(slug)) redirect("/onboarding");
  const { user, profile } = await currentProfile();
  if (mode === "onboarding") assertStepAllowed(profile.onboardingStep, slug);

  let result: StepState | void;
  switch (slug) {
    case "photos":
      result = await savePhotosStep(profile.id);
      break;
    case "basics":
      result = await saveBasicsStep(user.id, profile.id, formData);
      break;
    case "location":
      result = await saveLocationStep(profile.id, formData);
      break;
    case "intent":
      result = await saveIntentStep(profile.id, formData);
      break;
    case "interests":
      result = await saveInterestsStep(profile.id, formData);
      break;
    case "music":
      result = await saveMusicStep(user.id, profile.id, formData);
      break;
    case "activity":
      result = await saveActivityStep(user.id, profile.id, formData);
      break;
    case "preferences":
      result = await savePreferencesStep(user.id, formData);
      break;
    case "privacy":
      result = await savePrivacyStep(user.id, formData);
      break;
  }
  if (result && (result.error || result.fieldErrors)) return result;

  await recomputeCompleteness(user.id);

  // Editing an existing profile — persist and stay put.
  if (mode === "edit") {
    revalidatePath("/profile");
    revalidatePath("/profile/edit");
    revalidatePath("/discover");
    return { saved: true, persisted: result?.persisted };
  }

  const next = nextStep(slug);
  if (next) {
    // advance the resume pointer, but never move it backwards on a re-edit
    if (
      profile.onboardingStep &&
      stepIndex(next) > stepIndex(profile.onboardingStep)
    ) {
      await db.profile.update({
        where: { id: profile.id },
        data: { onboardingStep: next },
      });
    }
    await recomputeCompleteness(user.id);
    redirect(`/onboarding/${next}`);
  }

  // last step → finish onboarding
  await db.$transaction([
    db.profile.update({ where: { id: profile.id }, data: { onboardingStep: null } }),
    db.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", lastActiveAt: new Date() },
    }),
  ]);
  await recomputeCompleteness(user.id);
  redirect("/discover");
}

// ─── Step implementations ────────────────────────────────────────────────────

async function savePhotosStep(profileId: string): Promise<StepState> {
  const count = await db.photo.count({ where: { profileId } });
  if (count < 1) return { error: "Add at least one photo to continue." };
  return {};
}

async function saveBasicsStep(
  userId: string,
  profileId: string,
  fd: FormData,
): Promise<StepState> {
  const parsed = basicsSchema.safeParse({
    displayName: fd.get("displayName"),
    gender: fd.get("gender"),
    pronouns: fd.get("pronouns") ?? "",
    orientation: fd.get("orientation") ?? "",
    bio: fd.get("bio") ?? "",
    heightCm: fd.get("heightCm") ?? "",
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const screen = await screenProfileText(userId, [
    { name: "displayName", value: d.displayName },
    { name: "bio", value: d.bio },
    { name: "pronouns", value: d.pronouns },
  ]);
  if (!screen.ok) return { fieldErrors: { [screen.field]: [screen.error] } };
  await db.profile.update({
    where: { id: profileId },
    data: {
      displayName: d.displayName,
      gender: d.gender,
      pronouns: d.pronouns || null,
      orientation: d.orientation ? d.orientation : null,
      bio: d.bio || null,
      heightCm: d.heightCm ?? null,
    },
  });
  return {};
}

async function saveLocationStep(profileId: string, fd: FormData): Promise<StepState> {
  const parsed = locationSchema.safeParse({
    city: fd.get("city"),
    locationPrecision: fd.get("locationPrecision") ?? "CITY",
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { city, locationPrecision } = parsed.data;
  const geo = await geocode.lookup(city);
  await db.profile.update({
    where: { id: profileId },
    data: {
      city: geo?.city ?? city,
      region: geo?.region ?? null,
      country: geo?.country ?? null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      timezone: geo?.timezone ?? null,
      locationPrecision,
    },
  });
  return {};
}

async function saveIntentStep(profileId: string, fd: FormData): Promise<StepState> {
  const parsed = intentSchema.safeParse({
    relationshipIntent: fd.get("relationshipIntent"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  await db.profile.update({
    where: { id: profileId },
    data: { relationshipIntent: parsed.data.relationshipIntent },
  });
  return {};
}

async function saveInterestsStep(profileId: string, fd: FormData): Promise<StepState> {
  const parsed = interestsSchema.safeParse({ interests: fd.getAll("interests") });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const slugs = parsed.data.interests;
  const found = await db.interest.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  await db.$transaction([
    db.profileInterest.deleteMany({ where: { profileId } }),
    db.profileInterest.createMany({
      data: found.map((i) => ({ profileId, interestId: i.id })),
    }),
  ]);
  return {};
}

async function saveMusicStep(
  userId: string,
  profileId: string,
  fd: FormData,
): Promise<StepState> {
  const parsed = musicSchema.safeParse({
    listeningMood: fd.get("listeningMood") ?? "",
    topGenres: fd.getAll("topGenres"),
    artists: fd.getAll("artists"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { listeningMood, topGenres, artists } = parsed.data;

  const screen = await screenProfileText(userId, [
    { name: "listeningMood", value: listeningMood },
  ]);
  if (!screen.ok) return { fieldErrors: { [screen.field]: [screen.error] } };

  const music = await db.musicProfile.upsert({
    where: { profileId },
    update: { listeningMood: listeningMood || null, topGenres, provider: "internal" },
    create: {
      profileId,
      listeningMood: listeningMood || null,
      topGenres,
      provider: "internal",
    },
  });

  await db.musicProfileArtist.deleteMany({ where: { musicProfileId: music.id } });
  let rank = 0;
  for (const name of dedupe(artists)) {
    const artist = await db.musicArtist.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await db.musicProfileArtist.create({
      data: { musicProfileId: music.id, artistId: artist.id, rank: rank++ },
    });
  }
  return {};
}

async function saveActivityStep(
  userId: string,
  profileId: string,
  fd: FormData,
): Promise<StepState> {
  const parsed = activitySchema.safeParse({
    preferredLifestyle: fd.get("preferredLifestyle") ?? "",
    activeDaysPerWeek: fd.get("activeDaysPerWeek") ?? "",
    activityTypes: fd.getAll("activityTypes"),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { preferredLifestyle, activeDaysPerWeek, activityTypes } = parsed.data;

  const screen = await screenProfileText(userId, [
    { name: "preferredLifestyle", value: preferredLifestyle },
  ]);
  if (!screen.ok) return { fieldErrors: { [screen.field]: [screen.error] } };

  const activity = await db.activityProfile.upsert({
    where: { profileId },
    update: {
      preferredLifestyle: preferredLifestyle || null,
      activeDaysPerWeek: activeDaysPerWeek ?? null,
    },
    create: {
      profileId,
      preferredLifestyle: preferredLifestyle || null,
      activeDaysPerWeek: activeDaysPerWeek ?? null,
    },
  });

  const found = await db.activityType.findMany({
    where: { slug: { in: activityTypes } },
    select: { id: true },
  });
  await db.$transaction([
    db.activityProfileType.deleteMany({
      where: { activityProfileId: activity.id },
    }),
    db.activityProfileType.createMany({
      data: found.map((t) => ({
        activityProfileId: activity.id,
        activityTypeId: t.id,
      })),
    }),
  ]);
  return {};
}

async function savePreferencesStep(userId: string, fd: FormData): Promise<StepState> {
  const parsed = preferencesSchema.safeParse({
    minAge: fd.get("minAge"),
    maxAge: fd.get("maxAge"),
    maxDistanceKm: fd.get("maxDistanceKm"),
    genders: fd.getAll("genders"),
    globalMode: fd.get("globalMode") === "on",
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  // `maxDistanceKm` is only present when the distance input was enabled
  // (i.e. worldwide off). When absent, leave the stored value untouched.
  const pref = await db.preference.update({
    where: { userId },
    data: {
      minAge: d.minAge,
      maxAge: d.maxAge,
      genders: d.genders,
      globalMode: d.globalMode,
      ...(d.maxDistanceKm !== undefined ? { maxDistanceKm: d.maxDistanceKm } : {}),
    },
    select: {
      minAge: true,
      maxAge: true,
      maxDistanceKm: true,
      genders: true,
      globalMode: true,
    },
  });
  return { persisted: pref };
}

async function savePrivacyStep(userId: string, fd: FormData): Promise<StepState> {
  const parsed = privacySchema.safeParse({
    musicVisibility: fd.get("musicVisibility") ?? "PUBLIC",
    activityVisibility: fd.get("activityVisibility") ?? "CONNECTIONS",
    showActiveStatus: fd.get("showActiveStatus") === "on",
    incognito: fd.get("incognito") === "on",
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  await db.privacySetting.update({
    where: { userId },
    data: {
      musicVisibility: d.musicVisibility,
      activityVisibility: d.activityVisibility,
      showActiveStatus: d.showActiveStatus,
      incognito: d.incognito,
    },
  });
  return {};
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}
