"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import type { DiscoveryProfile } from "@/lib/discovery/service";
import type { Highlight } from "@/lib/compatibility/types";
import { INTENT_LABELS } from "@/lib/enums/labels";
import { PhotoCarousel } from "./photo-carousel";
import { Badge, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DiscoveryCard({
  profile,
  onLike,
  onPass,
  onReact,
  pending,
}: {
  profile: DiscoveryProfile;
  onLike: () => void;
  onPass: () => void;
  onReact: () => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <article className="surface-card flex flex-col overflow-hidden">
      <div className="p-3 pb-0">
        <PhotoCarousel
          photos={profile.photos.slice(0, 1)}
          alt={profile.displayName}
          overlay={
            <div className="flex items-end justify-between gap-3">
              <div className="text-paper">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-2xl leading-none text-paper">
                    {profile.displayName}, {profile.age}
                  </h2>
                  {profile.verified.photo && <VerifiedBadge label="" />}
                </div>
                <p className="mt-1 text-sm text-paper/85">
                  {[profile.pronouns, profile.city, profile.distanceText]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {profile.isNew && <Badge tone="ok">New here</Badge>}
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-5 p-5">
        {/* Why you might connect — the hero of the card */}
        <section aria-label="Why you might connect">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink">
              {profile.compatibility.label}
            </span>
          </div>
          {profile.compatibility.highlights.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {profile.compatibility.highlights.map((h, idx) => (
                <li key={idx}>
                  <HighlightChip h={h} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {profile.prompts[0] && (
          <blockquote className="border-l-2 border-glow-ring pl-3">
            <p className="text-xs text-ink-faint">{profile.prompts[0].question}</p>
            <p className="mt-1 text-[0.95rem] leading-relaxed text-ink text-pretty">
              {profile.prompts[0].answer}
            </p>
          </blockquote>
        )}

        {profile.music && (
          <IdentityRow
            label="On repeat"
            tone="moonlight"
            chips={profile.music.artists.slice(0, 5)}
            note={profile.music.mood}
          />
        )}

        {profile.activity && (
          <IdentityRow
            label="How they move"
            tone="glow"
            chips={profile.activity.activities.slice(0, 5)}
            note={profile.activity.lifestyle}
          />
        )}

        {profile.interests.length > 0 && (
          <IdentityRow label="Into" tone="neutral" chips={profile.interests.slice(0, 8)} />
        )}

        {expanded && (
          <div className="flex flex-col gap-5 border-t border-line pt-5">
            {profile.photos.slice(1).map((p) => (
              <div key={p.id} className="overflow-hidden rounded-[var(--radius-md)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={profile.displayName} className="w-full object-cover" />
              </div>
            ))}
            {profile.prompts.slice(1).map((pr) => (
              <blockquote key={pr.id} className="border-l-2 border-line pl-3">
                <p className="text-xs text-ink-faint">{pr.question}</p>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-ink text-pretty">
                  {pr.answer}
                </p>
              </blockquote>
            ))}
            {profile.bio && (
              <p className="text-sm leading-relaxed text-ink-soft text-pretty">{profile.bio}</p>
            )}
            {profile.intentLabel && (
              <p className="text-sm text-ink-soft">
                Looking for:{" "}
                <span className="text-ink">
                  {INTENT_LABELS[profile.intentLabel] ?? profile.intentLabel}
                </span>
              </p>
            )}
          </div>
        )}

        {(profile.photos.length > 1 ||
          profile.prompts.length > 1 ||
          profile.bio ||
          profile.intentLabel) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="self-start text-sm font-medium text-glow hover:text-glow-press"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : "See full profile"}
          </button>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-paper-raised/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onPass}
          disabled={pending}
          aria-label={`Pass on ${profile.displayName}`}
          className="grid size-12 shrink-0 place-items-center rounded-full border border-line-strong text-ink-soft hover:bg-sand disabled:opacity-50"
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <Button variant="secondary" onClick={onReact} disabled={pending} className="flex-1">
          React to something
        </Button>
        <Button onClick={onLike} loading={pending} className="flex-1">
          Like
        </Button>
      </div>
    </article>
  );
}

function HighlightChip({ h }: { h: Highlight }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        h.tone === "moonlight" && "bg-moonlight-soft text-moonlight",
        h.tone === "glow" && "bg-glow-soft text-glow-press",
        h.tone === "neutral" && "bg-sand text-ink-soft",
      )}
    >
      {h.text}
    </span>
  );
}

function IdentityRow({
  label,
  chips,
  note,
  tone,
}: {
  label: string;
  chips: string[];
  note?: string | null;
  tone: "glow" | "moonlight" | "neutral";
}) {
  if (chips.length === 0 && !note) return null;
  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">{label}</p>
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs",
                tone === "moonlight" && "bg-moonlight-soft text-moonlight",
                tone === "glow" && "bg-glow-soft text-glow-press",
                tone === "neutral" && "bg-sand text-ink-soft",
              )}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {note && <p className="mt-1.5 text-sm italic text-ink-soft text-pretty">“{note}”</p>}
    </section>
  );
}
