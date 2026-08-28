import { describe, expect, it } from "vitest";
import { getDictionary, t } from "./messages";
import { LOCALES } from "./config";

describe("message catalog", () => {
  it("exposes English nav labels", () => {
    const dict = getDictionary("en");
    expect(dict.nav.discover).toBe("Discover");
  });

  it("t() resolves dot paths and interpolates", () => {
    const dict = getDictionary("en");
    expect(t(dict, "nav.connections")).toBe("Connections");
    expect(t(dict, "common.retry")).toBe("Try again");
  });

  it("t() falls back to the key for an unknown path", () => {
    const dict = getDictionary("en");
    // @ts-expect-error deliberately invalid key
    expect(t(dict, "nav.nonexistent")).toBe("nav.nonexistent");
  });

  it("every registered locale has a complete nav section via fallback", () => {
    for (const loc of LOCALES) {
      const dict = getDictionary(loc);
      for (const key of ["discover", "connections", "activity", "profile", "notifications", "settings"] as const) {
        expect(typeof dict.nav[key]).toBe("string");
        expect(dict.nav[key].length).toBeGreaterThan(0);
      }
    }
  });
});
