"use client";

import * as React from "react";
import { revokeSessionAction } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";

export function SessionRow({
  id,
  label,
  lastUsed,
  current,
}: {
  id: string;
  label: string;
  lastUsed: string;
  current: boolean;
}) {
  const [pending, start] = React.useTransition();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink">
          {label}
          {current && <span className="ml-2 text-xs text-ok">This device</span>}
        </p>
        <p className="text-xs text-ink-faint">Last active {lastUsed}</p>
      </div>
      {!current && (
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          onClick={() => start(async () => void (await revokeSessionAction(id)))}
        >
          Revoke
        </Button>
      )}
    </div>
  );
}
