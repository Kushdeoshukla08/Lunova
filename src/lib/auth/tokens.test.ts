import { describe, expect, it } from "vitest";
import {
  generateNumericCode,
  generateToken,
  hashToken,
  safeEqualHex,
} from "./tokens";

describe("tokens", () => {
  it("hashToken is deterministic and 64 hex chars (sha-256)", () => {
    const a = hashToken("hello");
    expect(a).toBe(hashToken("hello"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(hashToken("hello ")); // sensitive to input
  });

  it("generateToken is url-safe and unique", () => {
    const t1 = generateToken();
    const t2 = generateToken();
    expect(t1).not.toBe(t2);
    expect(t1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generateNumericCode returns exactly N digits, zero-padded", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateNumericCode(6)).toMatch(/^\d{6}$/);
    }
  });

  it("safeEqualHex compares equal hashes and rejects different lengths", () => {
    const h = hashToken("x");
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, h.slice(0, 10))).toBe(false);
    expect(safeEqualHex(h, hashToken("y"))).toBe(false);
  });
});
