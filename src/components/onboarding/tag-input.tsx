"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/** Free-text tags → repeated hidden fields. Add on Enter/comma, remove with ×. */
export function TagInput({
  name,
  initial = [],
  max = 8,
  maxLength = 60,
  placeholder,
}: {
  name: string;
  initial?: string[];
  max?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const [tags, setTags] = React.useState<string[]>(() =>
    dedupe(initial).slice(0, max),
  );
  const [draft, setDraft] = React.useState("");

  const add = (raw: string) => {
    const value = raw.trim().slice(0, maxLength);
    if (!value) return;
    setTags((prev) =>
      prev.length >= max || prev.some((t) => t.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, value],
    );
    setDraft("");
  };

  return (
    <div>
      {tags.map((t) => (
        <input key={t} type="hidden" name={name} value={t} />
      ))}
      <div
        className={cn(
          "flex flex-wrap gap-1.5 rounded-[var(--radius-md)] border border-line-strong bg-paper-raised p-2",
          "focus-within:border-glow focus-within:ring-4 focus-within:ring-glow-ring/40",
        )}
      >
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-sm text-ink"
          >
            {t}
            <button
              type="button"
              onClick={() => setTags((p) => p.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
              // A bare "×" glyph is a ~9px target. Expand the hit area, but
              // only to 1.75rem — a full 2.75rem would overlap the next chip.
              className="tap-target [--tap:1.75rem] text-ink-faint hover:text-ink"
            >
              ×
            </button>
          </span>
        ))}
        {tags.length < max && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && tags.length) {
                setTags((p) => p.slice(0, -1));
              }
            }}
            onBlur={() => add(draft)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-faint"
          />
        )}
      </div>
    </div>
  );
}

function dedupe(xs: string[]) {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
