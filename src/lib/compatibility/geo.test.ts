import { describe, expect, it } from "vitest";
import {
  ageFromBirthdate,
  describeAgeBand,
  describeDistance,
  haversineKm,
} from "./geo";

describe("haversineKm", () => {
  it("Lisbon → Berlin is roughly 2300 km", () => {
    const km = haversineKm(
      { latitude: 38.7223, longitude: -9.1393 },
      { latitude: 52.52, longitude: 13.405 },
    );
    expect(km).toBeGreaterThan(2200);
    expect(km).toBeLessThan(2400);
  });
  it("a point to itself is 0", () => {
    expect(haversineKm({ latitude: 10, longitude: 10 }, { latitude: 10, longitude: 10 })).toBe(0);
  });
});

describe("describeDistance", () => {
  it("never reveals a precise sub-2km number", () => {
    expect(describeDistance(0.6, "CITY")).toBe("Nearby");
  });
  it("buckets to 5km at city precision", () => {
    expect(describeDistance(12, "CITY")).toBe("10 km away");
  });
  it("buckets coarsely at region precision", () => {
    expect(describeDistance(40, "REGION")).toBe("50 km away");
  });
  it("returns null with no distance", () => {
    expect(describeDistance(null, "CITY")).toBeNull();
  });
});

describe("ageFromBirthdate", () => {
  it("does not count the current year before the birthday", () => {
    const ref = new Date(2026, 5, 1); // Jun 1 2026
    expect(ageFromBirthdate(new Date(2000, 7, 15), ref)).toBe(25); // birthday in Aug
    expect(ageFromBirthdate(new Date(2000, 3, 15), ref)).toBe(26); // birthday in Apr
  });
});

describe("describeAgeBand", () => {
  it("splits each decade into three parts", () => {
    expect(describeAgeBand(20)).toBe("early 20s");
    expect(describeAgeBand(23)).toBe("early 20s");
    expect(describeAgeBand(24)).toBe("mid 20s");
    expect(describeAgeBand(26)).toBe("mid 20s");
    expect(describeAgeBand(27)).toBe("late 20s");
    expect(describeAgeBand(29)).toBe("late 20s");
    expect(describeAgeBand(30)).toBe("early 30s");
  });

  it("keeps the youngest members out of a decade label", () => {
    expect(describeAgeBand(18)).toBe("late teens");
    expect(describeAgeBand(19)).toBe("late teens");
  });

  it("stays sensible for much older members", () => {
    expect(describeAgeBand(52)).toBe("early 50s");
    expect(describeAgeBand(78)).toBe("late 70s");
  });

  it("is coarse enough to be worth having", () => {
    // Three or four ages share every label — a band that identified a single
    // year would not be a privacy control at all.
    const bands = new Map<string, number>();
    for (let age = 20; age <= 79; age++) {
      const b = describeAgeBand(age);
      bands.set(b, (bands.get(b) ?? 0) + 1);
    }
    for (const [band, count] of bands) {
      expect(count, band).toBeGreaterThanOrEqual(3);
    }
  });
});
