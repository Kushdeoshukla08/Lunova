"use client";

import { useActionState } from "react";
import Link from "next/link";
import { logInAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/auth/form-message";

const initial: AuthFormState = {};

export function LogInForm() {
  const [state, action, pending] = useActionState(logInAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state.error} notice={state.notice} />

      <Field label="Email" required error={state.fieldErrors?.email?.[0]}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </Field>

      <Field label="Password" required error={state.fieldErrors?.password?.[0]}>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="-mt-1 text-right">
        <Link
          href="/reset-password"
          className="text-sm text-ink-soft hover:text-ink"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
