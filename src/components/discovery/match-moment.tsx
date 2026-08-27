"use client";

import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { buttonVariants } from "@/components/ui/button";
import type { Highlight } from "@/lib/compatibility/types";

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
  const shared = highlights[0];
  return (
    <Modal open={open} onClose={onClose} title="You found something in common">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="aurora grid size-20 place-items-center rounded-full border border-line">
          <span className="font-display text-2xl text-glow">✦</span>
        </div>
        <p className="text-lg font-display tracking-tight">
          You and {name} connected
        </p>
        {shared && (
          <p className="rounded-full bg-sand px-3 py-1 text-sm text-ink-soft">
            {shared.text}
          </p>
        )}
        <p className="max-w-xs text-sm leading-relaxed text-ink-soft text-pretty">
          {shared
            ? "That's your opener — no need to overthink it."
            : "Say hi with something specific from their profile."}
        </p>
        <div className="mt-2 flex w-full flex-col gap-2">
          {conversationId && (
            <Link
              href={`/connections/${conversationId}`}
              className={buttonVariants({ size: "lg", fullWidth: true })}
            >
              Send a message
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className={buttonVariants({ variant: "ghost", size: "lg", fullWidth: true })}
          >
            Keep discovering
          </button>
        </div>
      </div>
    </Modal>
  );
}
