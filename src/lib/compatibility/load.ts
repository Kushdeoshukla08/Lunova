import "server-only";
import { db } from "@/lib/db";
import type { CompatInput } from "./types";

/**
 * Build a CompatInput for one user. Used by matching (to store why a pair
 * matched) and by the conversation view (to show "you matched through …").
 * The discovery feed has its own batch loader.
 */
export async function loadCompatInput(userId: string): Promise<CompatInput | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      birthdate: true,
      profile: {
        select: {
          gender: true,
          relationshipIntent: true,
          latitude: true,
          longitude: true,
          interests: { select: { interest: { select: { slug: true } } } },
          prompts: { select: { question: { select: { slug: true } } } },
          music: {
            select: {
              topGenres: true,
              artists: { select: { artist: { select: { name: true } } } },
            },
          },
          activity: {
            select: {
              preferredLifestyle: true,
              types: { select: { activityType: { select: { slug: true } } } },
            },
          },
        },
      },
      preference: {
        select: {
          minAge: true,
          maxAge: true,
          maxDistanceKm: true,
          genders: true,
          globalMode: true,
        },
      },
    },
  });
  if (!u || !u.profile) return null;
  const p = u.profile;
  return {
    userId: u.id,
    birthdate: u.birthdate,
    gender: p.gender,
    relationshipIntent: p.relationshipIntent,
    latitude: p.latitude,
    longitude: p.longitude,
    interests: p.interests.map((i) => i.interest.slug),
    music: p.music
      ? {
          artists: p.music.artists.map((a) => a.artist.name.toLowerCase()),
          genres: p.music.topGenres.map((g) => g.toLowerCase()),
        }
      : null,
    activity: p.activity
      ? {
          types: p.activity.types.map((t) => t.activityType.slug),
          lifestyle: p.activity.preferredLifestyle,
        }
      : null,
    answeredPrompts: p.prompts.map((pr) => pr.question.slug),
    preference: u.preference ?? {
      minAge: 18,
      maxAge: 100,
      maxDistanceKm: 500,
      genders: [],
      globalMode: true,
    },
  };
}
