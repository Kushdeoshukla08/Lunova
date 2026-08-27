"use client";

import { useActionState, useState, useTransition } from "react";
import {
  resendVerificationAction,
  verifyEmailAction,
  type AuthFormState,
} from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/auth/form-message";

const initial: AuthFormState = {};

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyEmailAction, initial);
  const [resendMsg, setResendMsg] = useState<AuthFormState>({});
  const [resending, startResend] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage error={state.error} notice={state.notice} />
        <Field label="Verification code" required error={state.fieldErrors?.code?.[0]}>
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em]"
          />
        </Field>
        <Button type="submit" size="lg" fullWidth loading={pending}>
          Verify email
        </Button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-faint">Didn&apos;t get it?</span>
        <button
          type="button"
          className="font-medium text-glow hover:text-glow-press disabled:opacity-50"
          disabled={resending}
          onClick={() =>
            startResend(async () => setResendMsg(await resendVerificationAction()))
          }
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
      <FormMessage error={resendMsg.error} notice={resendMsg.notice} />
    </div>
  );
}
