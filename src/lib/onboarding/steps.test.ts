import { describe, expect, it } from "vitest";
import {
  FIRST_STEP,
  ONBOARDING_STEPS,
  isOnboardingSlug,
  nextStep,
  stepIndex,
  TOTAL_STEPS,
} from "./steps";

describe("onboarding steps", () => {
  it("has a stable ordered list", () => {
    expect(ONBOARDING_STEPS[0].slug).toBe(FIRST_STEP);
    expect(ONBOARDING_STEPS.at(-1)?.slug).toBe("privacy");
    expect(TOTAL_STEPS).toBe(ONBOARDING_STEPS.length);
  });

  it("nextStep walks forward then returns null at the end", () => {
    expect(nextStep("photos")).toBe("basics");
    expect(nextStep("preferences")).toBe("privacy");
    expect(nextStep("privacy")).toBeNull();
  });

  it("stepIndex is monotonic and -1 for unknown", () => {
    expect(stepIndex("photos")).toBe(0);
    expect(stepIndex("privacy")).toBe(TOTAL_STEPS - 1);
    expect(stepIndex("nope")).toBe(-1);
  });

  it("isOnboardingSlug guards route params", () => {
    expect(isOnboardingSlug("music")).toBe(true);
    expect(isOnboardingSlug("../etc")).toBe(false);
  });
});
