"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("admin error", error);
  }, [error]);

  return (
    <div className="rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft/40 p-8 text-center">
      <h1 className="text-lg font-display">The console hit an error</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {error.digest ? `Reference ${error.digest}. ` : ""}Try again.
      </p>
      <Button variant="secondary" className="mt-4" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}
