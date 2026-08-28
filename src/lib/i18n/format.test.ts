import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDayHeading,
  formatDistance,
  formatRelative,
  formatTime,
} from "./format";

describe("formatRelative", () => {
  const now = Date.now();
  it("collapses sub-minute to 'now', then minutes/hours", () => {
    expect(formatRelative(new Date(now - 20_000))).toBe("now");
    expect(formatRelative(new Date(now - 5 * 60_000))).toBe("5m");
    expect(formatRelative(new Date(now - 3 * 3_600_000))).toBe("3h");
  });
  it("weekday within a week, date beyond", () => {
    expect(formatRelative(new Date(now - 3 * 86_400_000))).toMatch(/^[A-Z][a-z]{2}$/);
    expect(formatRelative(new Date(now - 40 * 86_400_000))).toMatch(/\d/);
  });
});

describe("formatDayHeading", () => {
  it("labels today and yesterday in the given timezone", () => {
    expect(formatDayHeading(new Date(), { locale: "en", timeZone: "UTC", units: "metric" })).toBe(
      "Today",
    );
    const y = new Date(Date.now() - 86_400_000);
    expect(formatDayHeading(y, { locale: "en", timeZone: "UTC", units: "metric" })).toBe(
      "Yesterday",
    );
  });
  it("a fixed instant lands on different calendar days across zones", () => {
    // 2026-03-01T01:00:00Z → still Feb 28 in Los Angeles
    const inst = new Date("2026-03-01T01:00:00Z");
    const utc = formatDayHeading(inst, { locale: "en", timeZone: "UTC", units: "metric" });
    const la = formatDayHeading(inst, { locale: "en", timeZone: "America/Los_Angeles", units: "metric" });
    expect(utc).not.toBe(la);
    expect(utc).toContain("March");
    expect(la).toContain("February");
  });
});

describe("formatTime", () => {
  it("renders in the requested timezone", () => {
    const inst = new Date("2026-03-01T12:00:00Z");
    const berlin = formatTime(inst, { locale: "en", timeZone: "Europe/Berlin", units: "metric" });
    const utc = formatTime(inst, { locale: "en", timeZone: "UTC", units: "metric" });
    expect(berlin).not.toBe(utc);
  });
});

describe("formatDate", () => {
  it("uses month names for en", () => {
    const out = formatDate(new Date("2026-08-28T00:00:00Z"), {
      locale: "en",
      timeZone: "UTC",
      units: "metric",
    });
    expect(out).toContain("August");
    expect(out).toContain("28");
    expect(out).toContain("2026");
  });
});

describe("formatDistance", () => {
  it("metric: coarse km, 'Nearby' under 2km", () => {
    expect(formatDistance(0.6, { units: "metric" })).toBe("Nearby");
    expect(formatDistance(12, { units: "metric" })).toBe("10 km away");
    expect(formatDistance(40, { units: "metric", precision: "REGION" })).toBe("50 km away");
  });
  it("imperial: miles, 'Nearby' under 1mi", () => {
    expect(formatDistance(1, { units: "imperial" })).toBe("Nearby");
    expect(formatDistance(20, { units: "imperial" })).toBe("12 mi away");
  });
  it("null in, null out", () => {
    expect(formatDistance(null)).toBeNull();
  });
});
