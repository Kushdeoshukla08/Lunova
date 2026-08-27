import { describe, expect, it } from "vitest";
import { computeCompleteness, type ProfileForCompleteness } from "./service";

const empty: ProfileForCompleteness = {
  displayName: null,
  bio: null,
  city: null,
  relationshipIntent: null,
  music: null,
  activity: null,
  _count: { photos: 0, interests: 0, prompts: 0 },
};

describe("computeCompleteness", () => {
  it("is 0 for an empty profile", () => {
    expect(computeCompleteness(empty)).toBe(0);
  });

  it("rewards the discovery-critical signals and caps at 100", () => {
    const full: ProfileForCompleteness = {
      displayName: "Maya",
      bio: "Slow mornings and long walks by the water most days.",
      city: "Lisbon",
      relationshipIntent: "LONG_TERM",
      music: { topGenres: ["Indie"] },
      activity: { types: [{}, {}] },
      _count: { photos: 4, interests: 8, prompts: 3 },
    };
    const score = computeCompleteness(full);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("weights a first photo heavily", () => {
    const withPhoto = { ...empty, _count: { ...empty._count, photos: 1 } };
    expect(computeCompleteness(withPhoto)).toBeGreaterThanOrEqual(20);
  });
});
