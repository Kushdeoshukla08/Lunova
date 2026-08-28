/** Shared shapes for the compatibility engine. Pure — no DB, no framework. */

export type HighlightKind =
  | "music"
  | "activity"
  | "interest"
  | "intent"
  | "distance"
  | "prompt";

export interface Highlight {
  kind: HighlightKind;
  /** Human-language, second person. e.g. "You both love hiking". */
  text: string;
  /** Visual accent — music moments use moonlight, everything else glow. */
  tone: "glow" | "moonlight" | "neutral";
  /** Relative importance for ordering (higher = shown first). */
  weight: number;
}

export interface SignalResult {
  /** 0–1 contribution for this signal. */
  score: number;
  highlights: Highlight[];
}

/** The subset of a profile the engine needs. Built by the discovery service. */
export interface CompatInput {
  userId: string;
  birthdate: Date;
  gender: string;
  relationshipIntent: string | null;
  latitude: number | null;
  longitude: number | null;
  interests: string[]; // slugs — the matching key
  /** slug → human label, for highlight text only. Optional; slugs are humanised if absent. */
  interestLabels?: Record<string, string>;
  music: { artists: string[]; genres: string[] } | null; // normalised lower-case
  activity: { types: string[]; lifestyle: string | null } | null;
  answeredPrompts: string[]; // question slugs
  preference: {
    minAge: number;
    maxAge: number;
    maxDistanceKm: number;
    genders: string[];
    globalMode: boolean;
  };
}

export type ConnectionLabel =
  | "Strong connection"
  | "A lot in common"
  | "Music match"
  | "Activity match"
  | "Different worlds, similar energy"
  | "Worth a look";

export interface CompatibilityResult {
  /** Internal ranking signal in [0,1] — NOT a prediction about the relationship. */
  score: number;
  label: ConnectionLabel;
  highlights: Highlight[];
  /** Whether both people's stated preferences are satisfied. */
  mutuallyEligible: boolean;
}
