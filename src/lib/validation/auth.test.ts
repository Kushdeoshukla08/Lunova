import { describe, expect, it } from "vitest";
import { logInSchema, signUpSchema, verifyCodeSchema, yearsSince } from "./auth";

function isoYearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString().slice(0, 10);
}

describe("signUpSchema", () => {
  const base = {
    email: "  Person@Example.com ",
    password: "abcd1234",
    birthdate: isoYearsAgo(25),
    acceptTerms: "on",
  };

  it("accepts a valid 25-year-old and normalises the email", () => {
    const r = signUpSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("person@example.com");
      expect(r.data.birthdate).toBeInstanceOf(Date);
    }
  });

  it("rejects someone under 18", () => {
    const r = signUpSchema.safeParse({ ...base, birthdate: isoYearsAgo(17) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.birthdate?.[0]).toMatch(/18 or older/);
    }
  });

  it("accepts someone exactly 18 today", () => {
    expect(signUpSchema.safeParse({ ...base, birthdate: isoYearsAgo(18) }).success).toBe(
      true,
    );
  });

  it("rejects a future birthdate", () => {
    const r = signUpSchema.safeParse({ ...base, birthdate: isoYearsAgo(-1) });
    expect(r.success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    expect(signUpSchema.safeParse({ ...base, password: "onlyletters" }).success).toBe(
      false,
    );
  });

  it("requires the terms checkbox", () => {
    const r = signUpSchema.safeParse({ ...base, acceptTerms: "off" });
    expect(r.success).toBe(false);
  });
});

describe("logInSchema", () => {
  it("requires a non-empty password", () => {
    expect(
      logInSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("verifyCodeSchema", () => {
  it("accepts exactly six digits", () => {
    expect(verifyCodeSchema.safeParse({ code: "012345" }).success).toBe(true);
  });
  it("rejects five digits or letters", () => {
    expect(verifyCodeSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(verifyCodeSchema.safeParse({ code: "12345a" }).success).toBe(false);
  });
});

describe("yearsSince", () => {
  it("counts whole years, not rounding up before the birthday", () => {
    const almost18 = new Date();
    almost18.setFullYear(almost18.getFullYear() - 18);
    almost18.setDate(almost18.getDate() + 2); // birthday is in 2 days
    expect(yearsSince(almost18)).toBe(17);
  });
});
