import "server-only";
import { moderateText } from "@/lib/moderation/provider";
import { recordSafetyEvent } from "@/lib/safety/events";
import { metrics } from "@/lib/observability/metrics";

export interface ProfileTextField {
  name: string;
  value: string | null | undefined;
}

export type ScreenResult =
  | { ok: true; flagged: string[] }
  | { ok: false; field: string; error: string };

/**
 * Screen user-authored profile copy before it goes live to the whole discovery
 * surface. Profile text reaches far more people than a single DM, so it gets the
 * same check messages do:
 *   • `reject` → the save is blocked with a field error.
 *   • `review` → the save goes through (we don't want false positives to lock
 *     someone out of onboarding) but a CONTENT_FLAGGED safety event is recorded
 *     for the moderation queue.
 */
export async function screenProfileText(
  userId: string,
  fields: ProfileTextField[],
): Promise<ScreenResult> {
  const flagged: string[] = [];

  for (const f of fields) {
    const value = f.value?.trim();
    if (!value) continue;
    const verdict = await moderateText(value, "bio");
    if (verdict.action === "reject") {
      metrics.increment(
        "lunova_profile_text_blocked_total",
        { field: f.name },
        "Profile free-text saves blocked by moderation",
      );
      return {
        ok: false,
        field: f.name,
        error: "That can't go on your profile. Please rephrase it.",
      };
    }
    if (verdict.action === "review") flagged.push(f.name);
  }

  if (flagged.length > 0) {
    await recordSafetyEvent({
      userId,
      type: "CONTENT_FLAGGED",
      severity: "LOW",
      source: "moderation",
      metadata: { surface: "profile", fields: flagged },
    });
  }

  return { ok: true, flagged };
}
