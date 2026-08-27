"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { DiscoveryProfile } from "@/lib/discovery/service";

export interface ReactTarget {
  elementRef: string;
  label: string;
  context: string;
}

/** Build the list of things on a profile you can react to. */
export function reactTargets(p: DiscoveryProfile): ReactTarget[] {
  const t: ReactTarget[] = [];
  p.prompts.forEach((pr) =>
    t.push({ elementRef: `prompt:${pr.id}`, label: pr.question, context: pr.answer }),
  );
  p.music?.artists.slice(0, 5).forEach((a) =>
    t.push({ elementRef: `artist:${slug(a)}`, label: "Music", context: a }),
  );
  p.activity?.activities.slice(0, 5).forEach((a) =>
    t.push({ elementRef: `activity:${slug(a)}`, label: "Activity", context: a }),
  );
  p.photos.forEach((ph, i) =>
    t.push({ elementRef: `photo:${ph.id}`, label: `Photo ${i + 1}`, context: "" }),
  );
  return t;
}

export function ReactSheet({
  open,
  onClose,
  profile,
  onSend,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  profile: DiscoveryProfile;
  onSend: (elementRef: string, comment: string) => void;
  pending: boolean;
}) {
  const targets = React.useMemo(() => reactTargets(profile), [profile]);
  const [picked, setPicked] = React.useState<ReactTarget | null>(null);
  const [text, setText] = React.useState("");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={picked ? "Say something about it" : `React to ${profile.displayName}'s profile`}
      description={
        picked
          ? undefined
          : "Pick one thing. A specific opener beats “hey” every time."
      }
      footer={
        picked ? (
          <>
            <Button variant="ghost" onClick={() => setPicked(null)}>
              Back
            </Button>
            <Button
              onClick={() => onSend(picked.elementRef, text.trim())}
              loading={pending}
              disabled={text.trim().length < 2}
            >
              Send & like
            </Button>
          </>
        ) : null
      }
    >
      {!picked ? (
        <ul className="flex flex-col gap-2">
          {targets.map((tg) => (
            <li key={tg.elementRef}>
              <button
                type="button"
                onClick={() => setPicked(tg)}
                className={cn(
                  "w-full rounded-[var(--radius-md)] border border-line-strong bg-paper-raised px-3.5 py-3 text-left",
                  "hover:border-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow",
                )}
              >
                <span className="text-xs uppercase tracking-wider text-ink-faint">
                  {tg.label}
                </span>
                {tg.context && (
                  <span className="mt-0.5 block text-sm text-ink text-pretty line-clamp-2">
                    {tg.context}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-[var(--radius-md)] bg-sand px-3.5 py-2.5">
            <p className="text-xs uppercase tracking-wider text-ink-faint">{picked.label}</p>
            {picked.context && <p className="mt-0.5 text-sm text-ink">{picked.context}</p>}
          </div>
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="I have so many thoughts about this…"
          />
          <p className="text-xs text-ink-faint">
            This sends a like with your note attached — a head start on the conversation.
          </p>
        </div>
      )}
    </Modal>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
