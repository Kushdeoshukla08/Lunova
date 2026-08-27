import type { DiscoveryProfile } from "./service";

export interface Opener {
  /** The suggested line to send. */
  text: string;
  /** What it hooks onto — for the "send & like" element reference. */
  elementRef?: string;
  /** A short label for the source, e.g. "their music". */
  source: string;
}

/**
 * A single, specific conversation starter derived from the strongest thing you
 * have in common. This is the answer to "what could I say to them?" — surfaced
 * on the card so the first message is never "hey".
 *
 * Deterministic (no randomness) so the same card always suggests the same line.
 */
export function suggestOpener(p: DiscoveryProfile): Opener | null {
  const h = p.compatibility.highlights;

  const music = h.find((x) => x.kind === "music");
  if (music) {
    const artist = sharedName(music.text) ?? p.music?.artists[0];
    if (artist) {
      return {
        text: `I've had ${artist} on repeat lately too — what's the one song you always come back to?`,
        elementRef: `artist:${slug(artist)}`,
        source: "your shared music",
      };
    }
  }

  const activity = h.find((x) => x.kind === "activity");
  if (activity && p.activity?.activities.length) {
    const act = p.activity.activities[0].toLowerCase();
    return {
      text: `We should ${verbFor(act)} sometime. Where's your usual spot?`,
      elementRef: `activity:${slug(p.activity.activities[0])}`,
      source: "your shared activities",
    };
  }

  const prompt = p.prompts[0];
  if (prompt) {
    return {
      text: `“${truncate(prompt.answer, 70)}” — okay, I need to hear more about this.`,
      elementRef: `prompt:${prompt.id}`,
      source: "their prompt",
    };
  }

  const interest = h.find((x) => x.kind === "interest");
  if (interest && p.interests.length) {
    return {
      text: `Fellow ${p.interests[0].toLowerCase()} person — how did you get into it?`,
      source: "a shared interest",
    };
  }

  return null;
}

/** Extract the artist name from "You both listen to Big Thief". */
function sharedName(text: string): string | null {
  const m = text.match(/listen to (.+)$/);
  return m ? m[1].trim() : null;
}

function verbFor(activity: string): string {
  const map: Record<string, string> = {
    running: "go for a run",
    "trail running": "hit a trail",
    hiking: "go for a hike",
    cycling: "go for a ride",
    swimming: "swim",
    climbing: "climb",
    yoga: "do a class",
    walking: "take a long walk",
    dance: "go dancing",
  };
  return map[activity] ?? `do ${activity}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
