import { describe, expect, it } from "vitest";
import {
  computeCompatibility,
  explainCompatibility,
  intentSignal,
  interestsSignal,
  musicSignal,
  mutuallyEligible,
} from "./engine";
import type { CompatInput } from "./types";

function person(over: Partial<CompatInput> = {}): CompatInput {
  return {
    userId: over.userId ?? "u",
    birthdate: over.birthdate ?? new Date(1996, 0, 1),
    gender: over.gender ?? "WOMAN",
    relationshipIntent: over.relationshipIntent ?? "LONG_TERM",
    latitude: over.latitude ?? 38.72,
    longitude: over.longitude ?? -9.14,
    interests: over.interests ?? [],
    music: over.music ?? null,
    activity: over.activity ?? null,
    answeredPrompts: over.answeredPrompts ?? [],
    preference: over.preference ?? {
      minAge: 18,
      maxAge: 99,
      maxDistanceKm: 100,
      genders: [],
      globalMode: false,
    },
  };
}

describe("intentSignal", () => {
  it("scores identical serious intent at 1 with a highlight", () => {
    const r = intentSignal(person(), person());
    expect(r.score).toBe(1);
    expect(r.highlights[0]?.kind).toBe("intent");
  });
  it("penalises a friends-vs-long-term mismatch", () => {
    const r = intentSignal(
      person({ relationshipIntent: "FRIENDS" }),
      person({ relationshipIntent: "LONG_TERM" }),
    );
    expect(r.score).toBeLessThan(0.5);
    expect(r.highlights).toHaveLength(0);
  });
});

describe("interestsSignal", () => {
  it("produces a shared-interest highlight and rising score", () => {
    const a = person({ interests: ["coffee", "hiking", "vinyl", "film"] });
    const b = person({ interests: ["coffee", "hiking", "vinyl", "chess"] });
    const r = interestsSignal(a, b);
    expect(r.score).toBeGreaterThan(0.3);
    expect(r.highlights[0].text).toMatch(/both like|shared interests/i);
  });
});

describe("musicSignal", () => {
  it("names a single shared artist", () => {
    const a = person({ music: { artists: ["phoebe bridgers"], genres: ["indie"] } });
    const b = person({ music: { artists: ["phoebe bridgers"], genres: ["pop"] } });
    const r = musicSignal(a, b);
    expect(r.highlights[0].text).toBe("You both listen to Phoebe Bridgers");
    expect(r.highlights[0].tone).toBe("moonlight");
  });
  it("is zero when either side has no music profile", () => {
    expect(musicSignal(person(), person()).score).toBe(0);
  });
});

describe("mutuallyEligible", () => {
  it("is false when one side's age filter excludes the other", () => {
    const young = person({ birthdate: new Date(2005, 0, 1) }); // ~21
    const picky = person({
      preference: { minAge: 30, maxAge: 40, maxDistanceKm: 100, genders: [], globalMode: false },
    });
    expect(mutuallyEligible(picky, young)).toBe(false);
  });
  it("respects gender preference both directions", () => {
    const a = person({
      gender: "MAN",
      preference: { minAge: 18, maxAge: 99, maxDistanceKm: 100, genders: ["WOMAN"], globalMode: false },
    });
    const b = person({
      gender: "WOMAN",
      preference: { minAge: 18, maxAge: 99, maxDistanceKm: 100, genders: ["NONBINARY"], globalMode: false },
    });
    expect(mutuallyEligible(a, b)).toBe(false);
  });
});

describe("computeCompatibility", () => {
  it("ranks a music+activity+interest overlap as a Strong connection", () => {
    const shared = {
      interests: ["coffee", "hiking", "vinyl", "film", "yoga"],
      music: { artists: ["the national", "big thief"], genres: ["indie", "folk"] },
      activity: { types: ["hiking", "running"], lifestyle: "trails" },
      answeredPrompts: ["a-perfect-sunday-looks-like"],
    };
    const a = person(shared);
    const b = person(shared);
    const r = computeCompatibility(a, b);
    expect(r.score).toBeGreaterThan(0.6);
    expect(r.label).toBe("Strong connection");
    expect(r.highlights.length).toBeGreaterThanOrEqual(3);
    expect(r.highlights.length).toBeLessThanOrEqual(4);
    expect(r.mutuallyEligible).toBe(true);
  });

  it("labels a music-only overlap a Music match", () => {
    const a = person({ music: { artists: ["fred again"], genres: ["house"] } });
    const b = person({
      relationshipIntent: "SHORT_TERM",
      music: { artists: ["fred again"], genres: ["techno"] },
    });
    const r = computeCompatibility(a, b);
    expect(r.label).toBe("Music match");
  });

  it("orders music highlights before distance", () => {
    const a = person({
      music: { artists: ["caroline polachek"], genres: [] },
    });
    const b = person({ music: { artists: ["caroline polachek"], genres: [] } });
    const r = computeCompatibility(a, b);
    expect(r.highlights[0].kind).toBe("music");
  });
});

describe("explainCompatibility", () => {
  const shared = {
    interests: ["coffee", "hiking", "vinyl"],
    music: { artists: ["big thief"], genres: ["folk"] },
    activity: { types: ["hiking"], lifestyle: "trails" },
    answeredPrompts: ["a-perfect-sunday"],
  };

  it("contributions sum to the blended score and rows are sorted by contribution", () => {
    const a = person({ ...shared, userId: "viewer" });
    const b = person({ ...shared, userId: "cand" });
    const ex = explainCompatibility(a, b);

    const summed = ex.signals.reduce((n, s) => n + s.contribution, 0);
    // score is clamped to [0,1]; below the clamp it must equal the sum of parts
    expect(Math.abs(summed - ex.score)).toBeLessThan(0.01);

    for (let i = 1; i < ex.signals.length; i++) {
      expect(ex.signals[i - 1].contribution).toBeGreaterThanOrEqual(ex.signals[i].contribution);
    }
  });

  it("only ever reports the six declared signals — no hidden term", () => {
    const ex = explainCompatibility(person(), person());
    expect(ex.signals.map((s) => s.signal).sort()).toEqual(
      ["activity", "distance", "intent", "interests", "music", "personality"],
    );
    const weightSum = ex.signals.reduce((n, s) => n + s.weight, 0);
    expect(Math.abs(weightSum - 1)).toBeLessThan(1e-9);
  });

  it("surfaces the preference gates", () => {
    const young = person({ birthdate: new Date(2005, 0, 1), userId: "y" });
    const picky = person({
      userId: "p",
      preference: { minAge: 30, maxAge: 40, maxDistanceKm: 100, genders: [], globalMode: false },
    });
    const ex = explainCompatibility(picky, young);
    expect(ex.gates.viewerAcceptsCandidate).toBe(false);
    expect(ex.gates.mutuallyEligible).toBe(false);
  });

  it("explanation score matches computeCompatibility for the same pair", () => {
    const a = person({ ...shared, userId: "a" });
    const b = person({ ...shared, userId: "b" });
    const ex = explainCompatibility(a, b);
    const direct = computeCompatibility(a, b);
    expect(ex.score).toBeCloseTo(direct.score, 3);
    expect(ex.label).toBe(direct.label);
  });
});
