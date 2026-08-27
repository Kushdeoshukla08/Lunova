"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import type { Highlight } from "@/lib/compatibility/types";

const KIND_WORD: Record<string, string> = {
  music: "music",
  activity: "movement",
  interest: "interests",
  intent: "what you're looking for",
  distance: "living close by",
  prompt: "how you think",
};

export function MatchMoment({
  open,
  onClose,
  name,
  conversationId,
  highlights,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  conversationId?: string;
  highlights: Highlight[];
}) {
  const headline = highlights[0];
  const kinds = [...new Set(highlights.map((h) => h.kind))].slice(0, 3);

  return (
    <Modal open={open} onClose={onClose} size="sm" bare>
      <div className="aura flex flex-col items-center gap-4 rounded-[inherit] px-6 py-10 text-center">
        <div className="relative grid size-24 place-items-center">
          <span
            aria-hidden="true"
            className="halo halo-breathe absolute inset-[-30%] rounded-full"
          />
          <span
            aria-hidden="true"
            className="relative grid size-16 place-items-center rounded-full border border-line bg-paper-raised text-2xl text-glow shadow-[var(--shadow-md)]"
          >
            ✦
          </span>
        </div>

        <Reveal index={0} className="editorial text-2xl leading-tight tracking-tight text-ink">
          You found something in common
        </Reveal>

        <Reveal index={1} className="text-sm text-ink-soft">
          You and <span className="text-ink">{name}</span> both said yes
        </Reveal>

        {headline && (
          <Reveal
            index={2}
            className="rounded-full bg-paper-raised px-3.5 py-1.5 text-sm font-medium text-glow-press shadow-[var(--shadow-sm)]"
          >
            {headline.text}
          </Reveal>
        )}

        {kinds.length > 0 && (
          <Reveal index={3} className="text-xs text-ink-faint">
            You matched through{" "}
            {kinds.map((k, i) => (
              <span key={k}>
                {i > 0 && (i === kinds.length - 1 ? " and " : ", ")}
                <span className="text-ink-soft">{KIND_WORD[k] ?? k}</span>
              </span>
            ))}
          </Reveal>
        )}

        <Reveal index={4} className="mt-1 flex w-full flex-col gap-2">
          {conversationId && (
            <Link
              href={`/connections/${conversationId}`}
              className={buttonVariants({ size: "lg", fullWidth: true })}
            >
              Say hi
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className={buttonVariants({ variant: "ghost", size: "lg", fullWidth: true })}
          >
            Keep discovering
          </button>
        </Reveal>
      </div>
    </Modal>
  );
}
