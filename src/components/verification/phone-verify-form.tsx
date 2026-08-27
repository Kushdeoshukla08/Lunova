"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPhoneAction,
  startPhoneVerificationAction,
  type VerifyResult,
} from "@/lib/verification/actions";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-message";

export function PhoneVerifyForm({ existingPhone }: { existingPhone: string | null }) {
  const router = useRouter();
  const [backToEnter, setBackToEnter] = React.useState(false);
  const [startState, startAction, starting] = useActionState<VerifyResult | null, FormData>(
    startPhoneVerificationAction,
    null,
  );
  const [confirmState, confirmAction, confirming] = useActionState<VerifyResult | null, FormData>(
    confirmPhoneAction,
    null,
  );
  const phase = !backToEnter && startState?.ok ? "confirm" : "enter";

  React.useEffect(() => {
    if (confirmState?.ok) router.refresh();
  }, [confirmState, router]);

  if (phase === "confirm") {
    return (
      <form action={confirmAction} className="flex flex-col gap-4">
        <FormMessage
          error={confirmState && !confirmState.ok ? confirmState.error : undefined}
          notice={confirmState?.ok ? confirmState.note : startState?.ok ? startState.note : undefined}
        />
        <Field label="Enter the 6-digit code">
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            required
            className="text-center text-lg tracking-[0.4em]"
          />
        </Field>
        <div className="flex gap-3">
          <Button type="submit" loading={confirming}>Verify</Button>
          <Button type="button" variant="ghost" onClick={() => setBackToEnter(true)}>
            Change number
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={startAction} className="flex flex-col gap-4">
      <FormMessage error={startState && !startState.ok ? startState.error : undefined} />
      <Field label="Phone number" hint="Include your country code, e.g. +14155550123.">
        <Input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={existingPhone ?? ""}
          placeholder="+1 415 555 0123"
          required
        />
      </Field>
      <Button type="submit" loading={starting}>Send code</Button>
    </form>
  );
}
