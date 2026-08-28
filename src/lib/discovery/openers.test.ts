import { describe, expect, it } from "vitest";
import { suggestOpener } from "./openers";
import type { DiscoveryProfile } from "./service";

function profile(over: Partial<DiscoveryProfile> = {}): DiscoveryProfile {
  return {
    userId: "u",
    displayName: "Arjun",
    age: 31,
    ageBand: "early 30s",
    pronouns: null,
    bio: null,
    city: "Lisbon",
    distanceText: "5 km away",
    photos: [],
    prompts: [],
    interests: [],
    music: null,
    activity: null,
    intentLabel: null,
    verified: { photo: false, identity: false },
    isNew: false,
    compatibility: { label: "Worth a look", highlights: [] },
    ...over,
  };
}

describe("suggestOpener", () => {
  it("prefers a shared artist and names it, with an element ref", () => {
    const o = suggestOpener(
      profile({
        music: { mood: null, artists: ["Big Thief", "Bonobo"], genres: [] },
        compatibility: {
          label: "Music match",
          highlights: [
            { kind: "music", text: "You both listen to Big Thief", tone: "moonlight", weight: 8 },
          ],
        },
      }),
    );
    expect(o?.text).toContain("Big Thief");
    expect(o?.elementRef).toBe("artist:big-thief");
    expect(o?.source).toMatch(/music/i);
  });

  it("falls back to a shared activity with a plausible invite", () => {
    const o = suggestOpener(
      profile({
        activity: { lifestyle: null, activities: ["Hiking", "Cycling"], activeDays: 3 },
        compatibility: {
          label: "Activity match",
          highlights: [
            { kind: "activity", text: "You both hike", tone: "glow", weight: 6 },
          ],
        },
      }),
    );
    expect(o?.text.toLowerCase()).toContain("hike");
    expect(o?.elementRef).toBe("activity:hiking");
  });

  it("uses a prompt answer when there's no music/activity overlap", () => {
    const o = suggestOpener(
      profile({
        prompts: [{ id: "p1", question: "A perfect Sunday…", answer: "Tide pools before the crowds" }],
      }),
    );
    expect(o?.text).toContain("Tide pools");
    expect(o?.elementRef).toBe("prompt:p1");
  });

  it("returns null when there is genuinely nothing to hook onto", () => {
    expect(suggestOpener(profile())).toBeNull();
  });
});
