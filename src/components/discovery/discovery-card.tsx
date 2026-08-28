"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import type { DiscoveryProfile } from "@/lib/discovery/service";
import type { Highlight } from "@/lib/compatibility/types";
import { suggestOpener } from "@/lib/discovery/openers";
import { INTENT_LABELS } from "@/lib/enums/labels";
import { PhotoCarousel } from "./photo-carousel";
import { VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

export function DiscoveryCard({
  profile,
  onLike,
  onPass,
  onWriteYourOwn,
  pending,
}: {
  profile: DiscoveryProfile;
  onLike: (comment?: string, elementRef?: string) => void;
  onPass: () => void;
  onWriteYourOwn: () => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const opener = React.useMemo(() => suggestOpener(profile), [profile]);
  const personality = firstSentence(profile.bio);
  const topHighlights = profile.compatibility.highlights.slice(0, 3);
  // Don't repeat, in an identity block, a reason already shown in "why you might click".
  const shownReasons = new Set(topHighlights.map((h) => h.text));
  const overlapFor = (kind: Highlight["kind"]) => {
    const t = highlightText(profile.compatibility.highlights, kind);
    return t && !shownReasons.has(t) ? t : null;
  };
  let step = 0;

  const hasMore =
    profile.photos.length > 1 ||
    profile.prompts.length > 1 ||
    Boolean(profile.bio && personality !== profile.bio) ||
    Boolean(profile.intentLabel);

  return (
    <article className="surface-raised flex flex-col overflow-hidden">
      <div className="p-2.5 pb-0">
        <PhotoCarousel
          photos={profile.photos}
          alt={profile.displayName}
          overlay={
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 text-paper">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-[1.6rem] leading-none tracking-tight text-paper">
                    {profile.displayName}
                    {/* Members who turned off "show my exact age" get a band. */}
                    <span className="text-paper/80">, {profile.age ?? profile.ageBand}</span>
                  </h2>
                  {profile.verified.photo && (
                    <span className="text-moonlight">
                      <VerifiedBadge label="" />
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[0.8rem] text-paper/85">
                  {[profile.pronouns, profile.city, profile.distanceText]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
              {profile.isNew && (
                <span className="shrink-0 rounded-full bg-paper/90 px-2.5 py-0.5 text-[0.7rem] font-medium text-ink">
                  New here
                </span>
              )}
            </div>
          }
        />
      </div>

      <div className="flex flex-col gap-6 px-5 py-5">
        {personality && (
          <Reveal index={step++} className="editorial text-[1.15rem] leading-snug text-ink text-pretty">
            {personality}
          </Reveal>
        )}

        {/* Why you might click — the hook */}
        {topHighlights.length > 0 && (
          <Reveal index={step++} className="flex flex-col gap-2.5">
            <div className="waypoint text-[0.7rem] font-semibold uppercase tracking-[0.09em]">
              Why you might click
            </div>
            <p className="text-sm font-medium text-glow-press">
              {profile.compatibility.label}
            </p>
            <ul className="flex flex-col gap-1.5">
              {topHighlights.map((h, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-ink">
                  <HDot tone={h.tone} />
                  {h.text}
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {/* Say something real — the opener, kept high so "what could I say?" is
            answered before the reader has to scroll through the detail. */}
        {opener && (
          <Reveal index={step++} className="rounded-[var(--radius-md)] bg-sand/60 p-4">
            <div className="waypoint text-[0.7rem] font-semibold uppercase tracking-[0.09em]">
              Say something real
            </div>
            <p className="editorial mt-2 text-[1rem] leading-snug text-ink text-pretty">
              “{opener.text}”
            </p>
            <p className="mt-1 text-xs text-ink-faint">Drawn from {opener.source}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onLike(opener.text, opener.elementRef)}
                loading={pending}
              >
                Send this &amp; like
              </Button>
              <Button size="sm" variant="ghost" onClick={onWriteYourOwn} disabled={pending}>
                Write your own
              </Button>
            </div>
          </Reveal>
        )}

        <div className="waypoint text-[0.7rem] font-semibold uppercase tracking-[0.09em]">
          More about {profile.displayName}
        </div>

        {profile.prompts[0] && (
          <Reveal index={step++} as="blockquote" className="border-l-2 border-glow-ring pl-3.5">
            <p className="overline">{profile.prompts[0].question}</p>
            <p className="editorial mt-1 text-[1.05rem] leading-relaxed text-ink text-pretty">
              {profile.prompts[0].answer}
            </p>
          </Reveal>
        )}

        {profile.music && (
          <Reveal index={step++}>
            <IdentityBlock
              tone="moonlight"
              label="In heavy rotation"
              names={profile.music.artists.slice(0, 6)}
              note={profile.music.mood}
              overlap={overlapFor("music")}
            />
          </Reveal>
        )}

        {profile.activity && (
          <Reveal index={step++}>
            <IdentityBlock
              tone="glow"
              label={activityHeading(profile.activity.activities)}
              names={profile.activity.activities.slice(0, 6)}
              note={
                profile.activity.lifestyle ??
                (profile.activity.activeDays != null
                  ? `Moving ${profile.activity.activeDays === 7 ? "most days" : `~${profile.activity.activeDays} days a week`}`
                  : null)
              }
              overlap={overlapFor("activity")}
            />
          </Reveal>
        )}

        {profile.interests.length > 0 && (
          <Reveal index={step++} className="flex flex-col gap-2">
            <div className="waypoint text-[0.7rem] font-semibold uppercase tracking-[0.09em]">
              Into
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 10).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink-soft"
                >
                  {c}
                </span>
              ))}
            </div>
          </Reveal>
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
              <blockquote key={pr.id} className="border-l-2 border-line pl-3.5">
                <p className="overline">{pr.question}</p>
                <p className="editorial mt-1 text-[1.05rem] leading-relaxed text-ink text-pretty">
                  {pr.answer}
                </p>
              </blockquote>
            ))}
            {profile.bio && personality !== profile.bio && (
              <p className="text-sm leading-relaxed text-ink-soft text-pretty">{profile.bio}</p>
            )}
            {profile.intentLabel && (
              <p className="text-sm text-ink-soft">
                Looking for{" "}
                <span className="text-ink">
                  {INTENT_LABELS[profile.intentLabel] ?? profile.intentLabel}
                </span>
              </p>
            )}
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="-mt-1 self-start text-sm font-medium text-glow hover:text-glow-press"
            aria-expanded={expanded}
          >
            {expanded ? "Show less" : "See full profile"}
          </button>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-center gap-4 border-t border-line bg-paper-raised/95 p-3.5 backdrop-blur">
        <button
          type="button"
          onClick={onPass}
          disabled={pending}
          aria-label={`Pass on ${profile.displayName}`}
          className="grid size-[3.25rem] place-items-center rounded-full border border-line-strong text-ink-soft transition-transform duration-[var(--dur-fast)] ease-[var(--ease-orbit)] hover:border-ink-faint hover:bg-sand active:scale-90 disabled:opacity-50"
        >
          <svg viewBox="0 0 22 22" className="size-6" aria-hidden="true">
            <path d="M6 6l10 10M16 6L6 16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onLike()}
          disabled={pending}
          aria-label={`Like ${profile.displayName}`}
          className="grid size-[3.75rem] place-items-center rounded-full bg-glow text-white shadow-[var(--shadow-md)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-orbit)] hover:bg-glow-press active:scale-90 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
            <path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13Z" />
          </svg>
        </button>
      </div>
    </article>
  );
}

function HDot({ tone }: { tone: Highlight["tone"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        tone === "moonlight" ? "bg-moonlight" : tone === "glow" ? "bg-glow" : "bg-ink-faint",
      )}
    />
  );
}

function IdentityBlock({
  label,
  names,
  note,
  overlap,
  tone,
}: {
  label: string;
  names: string[];
  note?: string | null;
  overlap?: string | null;
  tone: "moonlight" | "glow";
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="waypoint text-[0.7rem] font-semibold uppercase tracking-[0.09em]">
        {label}
      </div>
      <p
        className={cn(
          "text-[0.95rem] leading-relaxed",
          tone === "moonlight" ? "text-moonlight-ink" : "text-ink",
        )}
      >
        {names.join("  ·  ")}
      </p>
      {note && <p className="editorial text-sm italic text-ink-soft text-pretty">“{note}”</p>}
      {overlap && (
        <p
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            tone === "moonlight"
              ? "bg-moonlight-soft text-moonlight-ink"
              : "bg-glow-soft text-glow-press",
          )}
        >
          <span aria-hidden="true">↳</span> {overlap}
        </p>
      )}
    </div>
  );
}

function highlightText(highlights: Highlight[], kind: Highlight["kind"]): string | null {
  return highlights.find((h) => h.kind === kind)?.text ?? null;
}

function firstSentence(bio: string | null): string | null {
  if (!bio) return null;
  const trimmed = bio.trim();
  const m = trimmed.match(/^.*?[.!?](\s|$)/);
  const s = (m ? m[0] : trimmed).trim();
  return s.length > 4 ? s : null;
}

function activityHeading(activities: string[]): string {
  const set = new Set(activities.map((a) => a.toLowerCase()));
  const outside = ["running", "trail running", "hiking", "cycling", "surfing", "climbing", "swimming"];
  const training = ["gym & strength", "gym", "climbing", "calisthenics", "rowing"];
  const slow = ["yoga", "pilates", "walking", "dance"];
  if (outside.some((a) => set.has(a))) return "Usually outside";
  if (training.some((a) => set.has(a))) return "Usually training";
  if (slow.some((a) => set.has(a))) return "Moving at their own pace";
  return "How they move";
}
