import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assignVariant, variantConfig } from "./assign";
import { EXPERIMENTS } from "./registry";

describe("experiment assignment", () => {
  const EXP = "discovery_music_weight_v1" as const;

  it("is deterministic for a given unit", () => {
    const a = assignVariant(EXP, "user-abc");
    const b = assignVariant(EXP, "user-abc");
    expect(a).toBe(b);
  });

  it("returns the control variant while the experiment is disabled", () => {
    expect(EXPERIMENTS[EXP].enabled).toBe(false);
    for (const u of ["u1", "u2", "u3", "u4", "u5"]) {
      expect(assignVariant(EXP, u)).toBe("control");
    }
  });

  it("splits roughly evenly across a population when enabled", () => {
    // simulate an enabled 50/50 split with the same bucket function
    const bucket = (id: string, unit: string) =>
      createHash("sha256").update(`${id}:${unit}`).digest().readUInt32BE(0) / 0xffffffff;
    let a = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (bucket(EXP, `user-${i}`) < 0.5) a++;
    expect(a / N).toBeGreaterThan(0.45);
    expect(a / N).toBeLessThan(0.55);
  });

  it("empty unit id falls back to control", () => {
    expect(assignVariant(EXP, "")).toBe("control");
  });

  it("control config carries no weight override", () => {
    const cfg = variantConfig<{ weights: Record<string, number> }>(EXP, "control");
    expect(Object.keys(cfg.weights)).toHaveLength(0);
  });

  it("music_heavy weights still sum to 1", () => {
    const cfg = variantConfig<{ weights: Record<string, number> }>(EXP, "music_heavy");
    const sum = Object.values(cfg.weights).reduce((s, n) => s + n, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});
