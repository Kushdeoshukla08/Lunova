"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  submitPhotoVerificationAction,
  type VerifyResult,
} from "@/lib/verification/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-message";

export function PhotoVerifyForm({ rejected }: { rejected: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<VerifyResult | null, FormData>(
    submitPhotoVerificationAction,
    null,
  );
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState<string>();

  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {rejected && (
        <FormMessage error="Your last selfie didn't pass — try again with good light and your face clearly visible." />
      )}
      <FormMessage
        error={state && !state.ok ? state.error : undefined}
        notice={state?.ok ? state.note : undefined}
      />

      <input
        ref={fileRef}
        type="file"
        name="selfie"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="sr-only"
        onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-line-strong py-10 text-ink-faint hover:border-ink-faint hover:text-ink-soft"
      >
        <span className="text-2xl leading-none">📷</span>
        <span className="text-sm">{fileName ?? "Take a selfie"}</span>
      </button>

      <Button type="submit" loading={pending} disabled={!fileName}>
        Submit for verification
      </Button>
    </form>
  );
}
