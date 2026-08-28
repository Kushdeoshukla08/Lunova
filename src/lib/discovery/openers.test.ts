import { describe, expect, it } from "vitest";
import { quotedPromptId, suggestOpener } from "./openers";
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

describe("quotedPromptId", () => {
  // The discovery card uses this to avoid printing the same prompt answer twice
  // — once inside the suggested opener and again in "more about them".
  it("names the prompt an opener is quoting", () => {
    const p = profile({
      prompts: [
        { id: "p1", question: "A perfect Sunday…", answer: "Tide pools before the crowds" },
        { id: "p2", question: "I get weirdly excited about…", answer: "Bread" },
      ],
    });
    const opener = suggestOpener(p);
    expect(quotedPromptId(opener)).toBe("p1");
    // …so the card leads with the prompt the reader has not seen yet.
    expect(p.prompts.filter((x) => x.id !== quotedPromptId(opener))).toEqual([p.prompts[1]]);
  });

  it("is null when the opener came from somewhere else", () => {
    const music = suggestOpener(
      profile({
        music: { mood: null, artists: ["Big Thief"], genres: [] },
        prompts: [{ id: "p1", question: "Q", answer: "A" }],
        compatibility: {
          label: "Music match",
          highlights: [
            { kind: "music", text: "You both listen to Big Thief", tone: "moonlight", weight: 1 },
          ],
        },
      }),
    );
    expect(music?.elementRef).toContain("artist:");
    expect(quotedPromptId(music)).toBeNull();
  });

  it("is null for no opener at all", () => {
    expect(quotedPromptId(null)).toBeNull();
    expect(quotedPromptId(undefined)).toBeNull();
  });
});
