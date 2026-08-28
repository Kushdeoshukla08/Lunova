import {
  type CompatInput,
  type CompatibilityResult,
  type ConnectionLabel,
  type Highlight,
  type SignalResult,
} from "./types";
import { ageFromBirthdate, haversineKm } from "./geo";

/**
 * Modular compatibility engine. Each signal is a pure function returning a 0–1
 * score plus human-language highlights. The engine blends them with fixed
 * weights into a single ranking signal — it is explicitly NOT a prediction that
 * two people will have a successful relationship, and the UI never presents it
 * as one.
 */

export const WEIGHTS = {
  intent: 0.16,
  interests: 0.2,
  music: 0.22,
  activity: 0.2,
  distance: 0.14,
  personality: 0.08,
} as const;

// ─── Signals ─────────────────────────────────────────────────────────────────

/** Relationship-intent alignment (symmetric matrix, 0–1). */
export function intentSignal(a: CompatInput, b: CompatInput): SignalResult {
  if (!a.relationshipIntent || !b.relationshipIntent) return { score: 0.4, highlights: [] };
  const rank: Record<string, number> = {
    FRIENDS: 0,
    FIGURING_IT_OUT: 1,
    SHORT_TERM: 2,
    SHORT_TERM_OPEN_LONG: 3,
    LONG_TERM_OPEN_SHORT: 4,
    LONG_TERM: 5,
  };
  const gap = Math.abs((rank[a.relationshipIntent] ?? 2) - (rank[b.relationshipIntent] ?? 2));
  const score = Math.max(0, 1 - gap / 3);
  const highlights: Highlight[] =
    a.relationshipIntent === b.relationshipIntent && a.relationshipIntent !== "FIGURING_IT_OUT"
      ? [
          {
            kind: "intent",
            text: "You're looking for the same thing",
            tone: "neutral",
            weight: 3,
          },
        ]
      : [];
  return { score, highlights };
}

export function interestsSignal(a: CompatInput, b: CompatInput): SignalResult {
  const shared = intersect(a.interests, b.interests);
  const denom = Math.min(8, Math.max(a.interests.length, b.interests.length, 1));
  const score = clamp(shared.length / denom);
  const label = (slug: string) =>
    (a.interestLabels?.[slug] ?? b.interestLabels?.[slug] ?? humanizeSlug(slug)).toLowerCase();
  const highlights: Highlight[] =
    shared.length >= 2
      ? [
          {
            kind: "interest",
            text:
              shared.length >= 4
                ? `${shared.length} shared interests`
                : `You both like ${prettyList(shared.slice(0, 3).map(label))}`,
            tone: "glow",
            weight: 4 + Math.min(shared.length, 4),
          },
        ]
      : [];
  return { score, highlights };
}

export function musicSignal(a: CompatInput, b: CompatInput): SignalResult {
  if (!a.music || !b.music) return { score: 0, highlights: [] };
  const artists = intersect(a.music.artists, b.music.artists);
  const genres = intersect(a.music.genres, b.music.genres);
  const score = clamp(artists.length * 0.34 + genres.length * 0.12);
  const highlights: Highlight[] = [];
  if (artists.length) {
    highlights.push({
      kind: "music",
      text:
        artists.length === 1
          ? `You both listen to ${titleCase(artists[0])}`
          : `${artists.length} artists in common`,
      tone: "moonlight",
      weight: 7 + Math.min(artists.length, 3),
    });
  } else if (genres.length >= 2) {
    highlights.push({
      kind: "music",
      text: `Shared taste: ${prettyList(genres.slice(0, 2).map(titleCase))}`,
      tone: "moonlight",
      weight: 5,
    });
  }
  return { score, highlights };
}

export function activitySignal(a: CompatInput, b: CompatInput): SignalResult {
  if (!a.activity || !b.activity) return { score: 0, highlights: [] };
  const shared = intersect(a.activity.types, b.activity.types);
  const score = clamp(shared.length * 0.28);
  const highlights: Highlight[] = [];
  if (shared.length) {
    highlights.push({
      kind: "activity",
      text:
        shared.length === 1
          ? `You both ${activityVerb(shared[0])}`
          : `${shared.length} activities in common`,
      tone: "glow",
      weight: 6 + Math.min(shared.length, 3),
    });
  }
  return { score, highlights };
}

export function distanceSignal(
  a: CompatInput,
  b: CompatInput,
): SignalResult & { km: number | null } {
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return { score: 0.3, highlights: [], km: null };
  }
  const km = haversineKm(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude },
  );
  const reach = Math.max(a.preference.maxDistanceKm, b.preference.maxDistanceKm, 10);
  const score = a.preference.globalMode || b.preference.globalMode
    ? 0.5
    : clamp(1 - km / (reach * 1.5));
  const highlights: Highlight[] =
    km < 10 ? [{ kind: "distance", text: "Right nearby", tone: "neutral", weight: 2 }] : [];
  return { score, highlights, km };
}

export function personalitySignal(a: CompatInput, b: CompatInput): SignalResult {
  const shared = intersect(a.answeredPrompts, b.answeredPrompts);
  const score = clamp(shared.length * 0.25);
  const highlights: Highlight[] =
    shared.length >= 1
      ? [
          {
            kind: "prompt",
            text: "You answered some of the same prompts",
            tone: "neutral",
            weight: 2,
          },
        ]
      : [];
  return { score, highlights };
}

// ─── Preference gate ─────────────────────────────────────────────────────────

export function meetsPreferences(viewer: CompatInput, candidate: CompatInput): boolean {
  const candAge = ageFromBirthdate(candidate.birthdate);
  if (candAge < viewer.preference.minAge || candAge > viewer.preference.maxAge)
    return false;
  if (
    viewer.preference.genders.length > 0 &&
    !viewer.preference.genders.includes(candidate.gender)
  )
    return false;
  return true;
}

export function mutuallyEligible(a: CompatInput, b: CompatInput): boolean {
  return meetsPreferences(a, b) && meetsPreferences(b, a);
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Run every signal once. The single source of truth for both the ranking score
 * and the internal explanation — they can never disagree because they're
 * computed from the same object.
 */
function runSignals(viewer: CompatInput, candidate: CompatInput) {
  return {
    intent: intentSignal(viewer, candidate),
    interests: interestsSignal(viewer, candidate),
    music: musicSignal(viewer, candidate),
    activity: activitySignal(viewer, candidate),
    distance: distanceSignal(viewer, candidate),
    personality: personalitySignal(viewer, candidate),
  };
}

type SignalBag = ReturnType<typeof runSignals>;

function blendScore(s: SignalBag): number {
  return clamp(
    s.intent.score * WEIGHTS.intent +
      s.interests.score * WEIGHTS.interests +
      s.music.score * WEIGHTS.music +
      s.activity.score * WEIGHTS.activity +
      s.distance.score * WEIGHTS.distance +
      s.personality.score * WEIGHTS.personality,
  );
}

function topHighlights(s: SignalBag): Highlight[] {
  return [
    ...s.music.highlights,
    ...s.activity.highlights,
    ...s.interests.highlights,
    ...s.intent.highlights,
    ...s.personality.highlights,
    ...s.distance.highlights,
  ]
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 4);
}

export function computeCompatibility(
  viewer: CompatInput,
  candidate: CompatInput,
): CompatibilityResult & { distanceKm: number | null } {
  const s = runSignals(viewer, candidate);
  const score = blendScore(s);
  const highlights = topHighlights(s);

  return {
    score,
    label: pickLabel({ score, music: s.music, activity: s.activity, interests: s.interests, highlights }),
    highlights,
    mutuallyEligible: mutuallyEligible(viewer, candidate),
    distanceKm: s.distance.km,
  };
}

/** One row of the internal explanation. */
export interface SignalExplanation {
  signal: keyof typeof WEIGHTS;
  /** Raw 0–1 signal output. */
  raw: number;
  weight: number;
  /** raw × weight — how many points this signal put into the blended score. */
  contribution: number;
  /** Present only when the signal produced a user-facing highlight. */
  highlights: string[];
}

export interface CompatibilityExplanation {
  viewerId: string;
  candidateId: string;
  score: number;
  label: ConnectionLabel;
  /** Sorted by contribution, descending — the "why this person" ordering. */
  signals: SignalExplanation[];
  gates: {
    viewerAcceptsCandidate: boolean;
    candidateAcceptsViewer: boolean;
    mutuallyEligible: boolean;
  };
  distanceKm: number | null;
  shownHighlights: string[];
}

/**
 * The internal answer to "why did this person appear / rank here?". Never sent
 * to a member — this is for operators and debugging. It is derived from the
 * exact same signal run as the score, so it can't drift.
 */
export function explainCompatibility(
  viewer: CompatInput,
  candidate: CompatInput,
): CompatibilityExplanation {
  const s = runSignals(viewer, candidate);
  const score = blendScore(s);
  const highlights = topHighlights(s);

  const rows: SignalExplanation[] = (
    Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]
  ).map((signal) => {
    const result = s[signal];
    const weight = WEIGHTS[signal];
    return {
      signal,
      raw: round(result.score),
      weight,
      contribution: round(result.score * weight),
      highlights: result.highlights.map((h) => h.text),
    };
  });
  rows.sort((a, b) => b.contribution - a.contribution);

  return {
    viewerId: viewer.userId,
    candidateId: candidate.userId,
    score: round(score),
    label: pickLabel({ score, music: s.music, activity: s.activity, interests: s.interests, highlights }),
    signals: rows,
    gates: {
      viewerAcceptsCandidate: meetsPreferences(viewer, candidate),
      candidateAcceptsViewer: meetsPreferences(candidate, viewer),
      mutuallyEligible: mutuallyEligible(viewer, candidate),
    },
    distanceKm: s.distance.km,
    shownHighlights: highlights.map((h) => h.text),
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pickLabel(x: {
  score: number;
  music: SignalResult;
  activity: SignalResult;
  interests: SignalResult;
  highlights: Highlight[];
}): ConnectionLabel {
  if (x.score >= 0.62) return "Strong connection";
  if (x.music.highlights.some((h) => h.text.includes("listen") || h.text.includes("artists")))
    return "Music match";
  if (x.activity.highlights.length && x.activity.score >= 0.28) return "Activity match";
  if (x.score >= 0.4 || x.highlights.length >= 3) return "A lot in common";
  if (x.highlights.length >= 1) return "Different worlds, similar energy";
  return "Worth a look";
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function intersect(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return [...new Set(a)].filter((x) => set.has(x));
}
function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function prettyList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
/** Fallback for an interest slug with no label: "creative--film-photography" → "film photography". */
function humanizeSlug(slug: string): string {
  return (slug.split("--").at(-1) ?? slug).replace(/-/g, " ").trim();
}
function activityVerb(slug: string): string {
  const map: Record<string, string> = {
    running: "run",
    walking: "walk",
    cycling: "cycle",
    swimming: "swim",
    hiking: "hike",
    climbing: "climb",
    yoga: "do yoga",
    dance: "dance",
    "trail-running": "trail-run",
  };
  return map[slug] ?? `do ${slug.replace(/-/g, " ")}`;
}
