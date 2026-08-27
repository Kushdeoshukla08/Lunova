"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DiscoveryProfile } from "@/lib/discovery/service";
import { likeAction, passAction } from "@/lib/discovery/actions";
import { DiscoveryCard } from "./discovery-card";
import { ReactSheet } from "./react-sheet";
import { MatchMoment } from "./match-moment";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-message";

type Match = {
  name: string;
  conversationId?: string;
  highlights: DiscoveryProfile["compatibility"]["highlights"];
};

type ActionResult =
  | { ok: true; outcome: { matched: boolean; conversationId?: string; otherName?: string } }
  | { ok: false; error: string };

export function DiscoveryDeck({ profiles }: { profiles: DiscoveryProfile[] }) {
  const router = useRouter();
  const [queue, setQueue] = React.useState(() => profiles);
  const [total] = React.useState(() => profiles.length);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const [reacting, setReacting] = React.useState(false);
  const [match, setMatch] = React.useState<Match | null>(null);
  const [leaving, setLeaving] = React.useState<string | null>(null);

  const current = queue[0];
  const position = total - queue.length + 1;

  const act = (run: () => Promise<ActionResult>, target: DiscoveryProfile) => {
    if (pending || leaving) return;
    setReacting(false);
    setLeaving(target.userId);
    startTransition(async () => {
      const res = await run();
      // let the leave animation play briefly
      await new Promise((r) => setTimeout(r, 160));
      if (!res.ok) {
        setError(res.error);
        setLeaving(null);
        return;
      }
      setError(undefined);
      if (res.outcome.matched) {
        setMatch({
          name: res.outcome.otherName ?? target.displayName,
          conversationId: res.outcome.conversationId,
          highlights: target.compatibility.highlights,
        });
      }
      setQueue((q) => q.slice(1));
      setLeaving(null);
    });
  };

  const like = (comment?: string, elementRef?: string) => {
    if (!current) return;
    act(() => likeAction({ targetUserId: current.userId, comment, elementRef }), current);
  };
  const pass = () => {
    if (!current) return;
    act(() => passAction(current.userId), current);
  };

  if (!current) {
    return (
      <>
        <EmptyState
          title="That's everyone for now"
          description="You've seen everyone who fits your filters today. New people join constantly — check back soon, or widen your preferences."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.refresh()}>
                Refresh
              </Button>
              <Button variant="ghost" onClick={() => router.push("/settings")}>
                Adjust filters
              </Button>
            </div>
          }
        />
        <MatchMoment
          open={!!match}
          onClose={() => setMatch(null)}
          name={match?.name ?? ""}
          conversationId={match?.conversationId}
          highlights={match?.highlights ?? []}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>{position} of {total}</span>
        {queue.length > 1 && <span>{queue.length - 1} more</span>}
      </div>

      {error && <FormMessage error={error} />}

      <div
        key={current.userId}
        className="motion-safe:animate-[card-enter_var(--dur-slow)_var(--ease-orbit)]"
        style={
          leaving === current.userId
            ? { animation: "card-leave 200ms var(--ease-orbit) forwards" }
            : undefined
        }
      >
        <DiscoveryCard
          profile={current}
          pending={pending}
          onLike={like}
          onPass={pass}
          onWriteYourOwn={() => setReacting(true)}
        />
      </div>

      <ReactSheet
        key={reacting ? `react-${current.userId}` : "react-closed"}
        open={reacting}
        onClose={() => setReacting(false)}
        profile={current}
        pending={pending}
        onSend={(elementRef, comment) => like(comment, elementRef)}
      />

      <MatchMoment
        open={!!match}
        onClose={() => setMatch(null)}
        name={match?.name ?? ""}
        conversationId={match?.conversationId}
        highlights={match?.highlights ?? []}
      />
    </div>
  );
}
