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

type Match = { name: string; conversationId?: string; highlights: DiscoveryProfile["compatibility"]["highlights"] };

export function DiscoveryDeck({ profiles }: { profiles: DiscoveryProfile[] }) {
  const router = useRouter();
  const [index, setIndex] = React.useState(0);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | undefined>();
  const [reacting, setReacting] = React.useState(false);
  const [match, setMatch] = React.useState<Match | null>(null);

  const current = profiles[index];

  const advance = () => {
    setError(undefined);
    setIndex((i) => i + 1);
  };

  const handleLike = (comment?: string, elementRef?: string) => {
    if (!current) return;
    const target = current;
    setReacting(false);
    startTransition(async () => {
      const res = await likeAction({
        targetUserId: target.userId,
        comment,
        elementRef,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.outcome.matched) {
        setMatch({
          name: res.outcome.otherName ?? target.displayName,
          conversationId: res.outcome.conversationId,
          highlights: target.compatibility.highlights,
        });
      }
      advance();
    });
  };

  const handlePass = () => {
    if (!current) return;
    const target = current;
    startTransition(async () => {
      const res = await passAction(target.userId);
      if (!res.ok) setError(res.error);
      advance();
    });
  };

  if (!current) {
    return (
      <EmptyState
        title="That's everyone for now"
        description="You've seen all the people who match your filters today. New members join constantly — check back soon, or widen your preferences."
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
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>
          {index + 1} of {profiles.length}
        </span>
      </div>

      {error && <FormMessage error={error} />}

      <DiscoveryCard
        key={current.userId}
        profile={current}
        pending={pending}
        onLike={() => handleLike()}
        onPass={handlePass}
        onReact={() => setReacting(true)}
      />

      <ReactSheet
        key={reacting ? `react-${current.userId}` : "react-closed"}
        open={reacting}
        onClose={() => setReacting(false)}
        profile={current}
        pending={pending}
        onSend={(elementRef, comment) => handleLike(comment, elementRef)}
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
