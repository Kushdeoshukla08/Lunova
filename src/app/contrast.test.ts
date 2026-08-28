/**
 * WCAG 2.2 SC 1.4.3 (Contrast Minimum, AA) over the design tokens themselves.
 *
 * Reads the real values out of globals.css, so it fails when someone changes a
 * colour rather than when someone forgets to re-audit. Every pair here is a
 * combination the product actually renders — a token pair that is never drawn
 * together is not worth constraining.
 *
 * The light theme had eight failures when this was written, including the
 * bottom-nav labels and the primary button; the dark theme put white text on a
 * light rose at 3:1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

/** Pull one `--token: #hex;` out of a specific block of the stylesheet. */
function tokensIn(startMarker: string): Record<string, string> {
  const start = css.indexOf(startMarker);
  if (start < 0) throw new Error(`block not found: ${startMarker}`);
  // Stop at the Tailwind mapping block, which only aliases.
  const end = css.indexOf("@theme inline", start);
  const block = css.slice(start, end < 0 ? undefined : end);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    // First definition wins, so a later theme block does not overwrite an
    // earlier one when both are inside the slice.
    out[m[1]!] ??= m[2]!.toLowerCase();
  }
  return out;
}

const light = tokensIn(":root {");
const dark = tokensIn(':root[data-theme="dark"]');

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function luminance(c: [number, number, number]): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(rgb(fg)), luminance(rgb(bg))].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Text-on-background pairs the UI actually renders. */
const PAIRS: [fg: string, bg: string, what: string][] = [
  ["--ink", "--paper", "body text"],
  ["--ink", "--paper-raised", "body text on a card"],
  ["--ink-soft", "--paper", "secondary text"],
  ["--ink-soft", "--sand", "secondary text on a tint"],
  ["--ink-faint", "--paper", "muted text"],
  ["--ink-faint", "--paper-raised", "muted text on a card"],
  ["--ink-faint", "--sand", "muted text on a tint — the bottom nav labels"],
  ["--glow", "--paper", "brand link"],
  ["--glow", "--paper-raised", "brand link on a card"],
  ["--glow", "--sand", "brand link on a tint"],
  ["--on-glow", "--glow", "label on the primary button"],
  ["--on-glow", "--glow-press", "label on the pressed button"],
  ["--glow-ink", "--glow-soft", "badge label on the brand tint"],
  ["--moonlight-ink", "--moonlight-soft", "music badge"],
  ["--moonlight-ink", "--paper-raised", "music text on a card"],
  ["--ok-ink", "--ok-soft", "verified badge"],
  ["--warn-ink", "--warn-soft", "warning badge"],
  ["--danger-ink", "--danger-soft", "danger badge"],
  ["--danger", "--paper-raised", "destructive text"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (name, theme) => {
  it("defines every token the pairs reference", () => {
    const missing = [...new Set(PAIRS.flatMap(([f, b]) => [f, b]))].filter((t) => !theme[t]);
    expect(missing, `${name} is missing tokens`).toEqual([]);
  });

  it.each(PAIRS)("%s on %s (%s) meets 4.5:1", (fg, bg, what) => {
    const ratio = contrast(theme[fg]!, theme[bg]!);
    expect(
      Number(ratio.toFixed(2)),
      `${name}: ${what} — ${fg} ${theme[fg]} on ${bg} ${theme[bg]}`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe("theme blocks stay in step", () => {
  it("the explicit dark toggle defines the same tokens as the media query", () => {
    // The stylesheet carries dark twice: once under prefers-color-scheme and
    // once under [data-theme="dark"]. A token added to one and not the other is
    // a contrast bug for whoever picked dark mode by hand.
    const mediaStart = css.indexOf("@media (prefers-color-scheme: dark)");
    const mediaEnd = css.indexOf(':root[data-theme="dark"]');
    const mediaBlock = css.slice(mediaStart, mediaEnd);
    const mediaTokens = new Set(
      [...mediaBlock.matchAll(/(--[a-z-]+):\s*#[0-9a-fA-F]{6}\s*;/g)].map((m) => m[1]!),
    );
    const explicitTokens = new Set(Object.keys(dark));
    const onlyInMedia = [...mediaTokens].filter((t) => !explicitTokens.has(t));
    const onlyInExplicit = [...explicitTokens].filter((t) => !mediaTokens.has(t));
    expect({ onlyInMedia, onlyInExplicit }).toEqual({ onlyInMedia: [], onlyInExplicit: [] });
  });
});
