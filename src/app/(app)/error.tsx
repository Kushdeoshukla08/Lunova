"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-6">
      <ErrorState
        title="This page couldn't load"
        description="That's on us. Try again — if it keeps happening, come back in a bit."
        action={
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
