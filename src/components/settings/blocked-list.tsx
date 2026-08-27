"use client";

import * as React from "react";
import { unblockAction } from "@/lib/safety/actions";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";

export function BlockedList({
  blocked,
}: {
  blocked: { userId: string; name: string; photoUrl: string | null; at: string }[];
}) {
  const [items, setItems] = React.useState(blocked);
  const [pendingId, setPendingId] = React.useState<string>();
  const [, start] = React.useTransition();

  if (items.length === 0) {
    return (
      <EmptyState
        title="You haven't blocked anyone"
        description="If someone makes you uncomfortable, you can block them from their profile or any conversation."
      />
    );
  }

  return (
    <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-paper-raised">
      {items.map((b) => (
        <li key={b.userId} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={b.name} src={b.photoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{b.name}</p>
            <p className="text-xs text-ink-faint">Blocked {b.at}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            loading={pendingId === b.userId}
            onClick={() => {
              setPendingId(b.userId);
              start(async () => {
                const res = await unblockAction(b.userId);
                setPendingId(undefined);
                if (res.ok) setItems((xs) => xs.filter((x) => x.userId !== b.userId));
              });
            }}
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}
