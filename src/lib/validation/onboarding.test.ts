import { describe, expect, it } from "vitest";
import {
  basicsSchema,
  interestsSchema,
  musicSchema,
  preferencesSchema,
  stringArray,
} from "./onboarding";

describe("stringArray", () => {
  it("normalises single, missing and multiple values", () => {
    expect(stringArray.parse("a")).toEqual(["a"]);
    expect(stringArray.parse("")).toEqual([]);
    expect(stringArray.parse(undefined)).toEqual([]);
    expect(stringArray.parse(["a", " b "])).toEqual(["a", "b"]);
  });
});

describe("basicsSchema", () => {
  const ok = { displayName: "Maya", gender: "WOMAN" };
  it("accepts the minimum valid payload", () => {
    expect(basicsSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects a one-character name and an unknown gender", () => {
    expect(basicsSchema.safeParse({ ...ok, displayName: "M" }).success).toBe(false);
    expect(basicsSchema.safeParse({ ...ok, gender: "ROBOT" }).success).toBe(false);
  });
  it("coerces an empty height to undefined", () => {
    const r = basicsSchema.safeParse({ ...ok, heightCm: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.heightCm).toBeUndefined();
  });
});

describe("interestsSchema", () => {
  it("requires at least 3 and at most 12", () => {
    expect(interestsSchema.safeParse({ interests: ["a", "b"] }).success).toBe(false);
    expect(interestsSchema.safeParse({ interests: ["a", "b", "c"] }).success).toBe(true);
    expect(
      interestsSchema.safeParse({ interests: Array.from({ length: 13 }, (_, i) => `i${i}`) })
        .success,
    ).toBe(false);
  });
});

describe("musicSchema", () => {
  it("caps genres at 6 and artists at 8", () => {
    const r = musicSchema.safeParse({
      listeningMood: "",
      topGenres: ["Pop", "Rock", "Jazz", "Soul", "Folk", "Punk", "Metal"],
      artists: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("preferencesSchema", () => {
  const base = { minAge: 25, maxAge: 40, maxDistanceKm: 50, genders: [] as string[] };
  it("accepts a sane range", () => {
    expect(preferencesSchema.safeParse(base).success).toBe(true);
  });
  it("rejects maxAge < minAge with a path", () => {
    const r = preferencesSchema.safeParse({ ...base, minAge: 40, maxAge: 25 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("maxAge"))).toBe(true);
    }
  });
  it("rejects an under-18 minimum", () => {
    expect(preferencesSchema.safeParse({ ...base, minAge: 16 }).success).toBe(false);
  });
});
