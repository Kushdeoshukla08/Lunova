import { describe, expect, it } from "vitest";
import { formatDayHeading, formatRelative } from "./format";

describe("formatRelative", () => {
  const now = Date.now();
  it("collapses sub-minute to 'now'", () => {
    expect(formatRelative(new Date(now - 20_000))).toBe("now");
  });
  it("uses minutes then hours", () => {
    expect(formatRelative(new Date(now - 5 * 60_000))).toBe("5m");
    expect(formatRelative(new Date(now - 3 * 3600_000))).toBe("3h");
  });
  it("switches to weekday within a week and a date beyond", () => {
    expect(formatRelative(new Date(now - 3 * 86_400_000))).toMatch(/^[A-Z][a-z]{2}$/);
    expect(formatRelative(new Date(now - 40 * 86_400_000))).toMatch(/\d/);
  });
});

describe("formatDayHeading", () => {
  it("labels today and yesterday", () => {
    expect(formatDayHeading(new Date())).toBe("Today");
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(formatDayHeading(y)).toBe("Yesterday");
  });
});
