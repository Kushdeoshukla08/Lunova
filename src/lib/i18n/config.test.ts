import { describe, expect, it } from "vitest";
import { isLocale, unitSystemFor, DEFAULT_LOCALE } from "./config";

describe("i18n config", () => {
  it("isLocale accepts shipped locales only", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("unitSystemFor keys off known country, defaulting to metric", () => {
    expect(unitSystemFor("en", "US")).toBe("imperial");
    expect(unitSystemFor("en", "GB")).toBe("imperial");
    expect(unitSystemFor("en", "DE")).toBe("metric");
    expect(unitSystemFor("en", "JP")).toBe("metric");
    // unknown country → metric (never guessed from language)
    expect(unitSystemFor("en", null)).toBe("metric");
    expect(unitSystemFor("en", undefined)).toBe("metric");
  });

  it("default locale is en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});
