import { z } from "zod";
import {
  Gender,
  LocationPrecision,
  Orientation,
  RelationshipIntent,
  Visibility,
} from "@/generated/prisma/enums";

const trimmed = (max: number) => z.string().trim().max(max);

/** Multi-value form fields arrive as repeated entries — normalise to string[]. */
export const stringArray = z.preprocess(
  (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]),
  z.array(z.string().trim().min(1)),
);

export const basicsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(40, { error: "Keep it under 40 characters." }),
  gender: z.enum(Gender, { error: "Choose an option." }),
  pronouns: trimmed(30).optional().or(z.literal("")),
  orientation: z.enum(Orientation).optional().or(z.literal("")),
  bio: trimmed(600).optional().or(z.literal("")),
  heightCm: z
    .coerce.number()
    .int()
    .min(120)
    .max(230)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const locationSchema = z.object({
  city: z
    .string()
    .trim()
    .min(2, { error: "Enter your city." })
    .max(80),
  locationPrecision: z.enum(LocationPrecision).default("CITY"),
});

export const intentSchema = z.object({
  relationshipIntent: z.enum(RelationshipIntent, { error: "Choose what fits best." }),
});

export const interestsSchema = z.object({
  interests: stringArray.pipe(
    z
      .array(z.string())
      .min(3, { error: "Pick at least 3." })
      .max(12, { error: "Pick up to 12." }),
  ),
});

export const musicSchema = z.object({
  listeningMood: trimmed(120).optional().or(z.literal("")),
  topGenres: stringArray.pipe(z.array(z.string().max(40)).max(6)),
  artists: stringArray.pipe(z.array(z.string().max(60)).max(8)),
});

export const activitySchema = z.object({
  preferredLifestyle: trimmed(120).optional().or(z.literal("")),
  activeDaysPerWeek: z
    .coerce.number()
    .int()
    .min(0)
    .max(7)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  activityTypes: stringArray.pipe(z.array(z.string()).max(8)),
});

export const preferencesSchema = z
  .object({
    minAge: z.coerce.number().int().min(18).max(100),
    maxAge: z.coerce.number().int().min(18).max(100),
    maxDistanceKm: z.coerce.number().int().min(1).max(500),
    genders: stringArray.pipe(z.array(z.enum(Gender)).max(9)),
    globalMode: z.coerce.boolean().optional().default(false),
  })
  .refine((v) => v.maxAge >= v.minAge, {
    error: "Max age can't be lower than min age.",
    path: ["maxAge"],
  });

export const privacySchema = z.object({
  musicVisibility: z.enum(Visibility).default("PUBLIC"),
  activityVisibility: z.enum(Visibility).default("CONNECTIONS"),
  showActiveStatus: z.coerce.boolean().optional().default(true),
  incognito: z.coerce.boolean().optional().default(false),
});
