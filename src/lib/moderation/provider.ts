import "server-only";
import { env } from "@/lib/env";

export type ModerationAction = "allow" | "review" | "reject";

export interface ModerationVerdict {
  action: ModerationAction;
  labels: Record<string, unknown>;
}

export interface ModerationProvider {
  readonly name: string;
  image(bytes: Buffer, contentType: string): Promise<ModerationVerdict>;
  text(value: string, context: "bio" | "prompt" | "message" | "report"): Promise<ModerationVerdict>;
}

/**
 * DEV provider — cheap heuristics, no external vendor. It is deliberately
 * conservative on text (contact-info / obvious slurs → review) and permissive on
 * images (a real vision model goes here in production via MODERATION_PROVIDER).
 */
class HeuristicModerationProvider implements ModerationProvider {
  readonly name = "heuristic";

  async image(bytes: Buffer, contentType: string): Promise<ModerationVerdict> {
    // No local vision model. Only sanity checks: type + non-empty + not enormous.
    const ok =
      bytes.length > 128 && contentType.startsWith("image/");
    return { action: ok ? "allow" : "reject", labels: { checked: "heuristic", bytes: bytes.length } };
  }

  async text(value: string): Promise<ModerationVerdict> {
    const v = value.toLowerCase();
    const hasContact =
      /\b\d{7,}\b/.test(v) ||
      /@[a-z0-9._-]+\.[a-z]{2,}/.test(v) ||
      /\b(whatsapp|telegram|snapchat|insta(gram)?|cashapp|venmo)\b/.test(v);
    const slurs = ["kys", "faggot", "retard", "n1gger"];
    const hasSlur = slurs.some((s) => v.includes(s));

    if (hasSlur) return { action: "reject", labels: { reason: "hate" } };
    if (hasContact) return { action: "review", labels: { reason: "contact_info" } };
    return { action: "allow", labels: {} };
  }
}

function build(): ModerationProvider {
  switch (env.MODERATION_PROVIDER) {
    // case "hive": return new HiveModerationProvider(env.IDV_API_KEY!);
    case "heuristic":
    default:
      return new HeuristicModerationProvider();
  }
}

const globalForMod = globalThis as unknown as { moderation?: ModerationProvider };
export const moderation: ModerationProvider =
  globalForMod.moderation ?? (globalForMod.moderation = build());

export const moderateImage = (b: Buffer, t: string) => moderation.image(b, t);
export const moderateText = (
  v: string,
  ctx: "bio" | "prompt" | "message" | "report",
) => moderation.text(v, ctx);
