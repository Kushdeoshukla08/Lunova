"use client";

import { useActionState } from "react";
import { signUpAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/auth/form-message";

const initial: AuthFormState = {};

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);

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
          placeholder="you@example.com"
        />
      </Field>

      <Field
        label="Password"
        required
        hint="At least 8 characters, with a letter and a number."
        error={state.fieldErrors?.password?.[0]}
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Field
        label="Date of birth"
        required
        hint="You must be 18 or older. We never show this on your profile."
        error={state.fieldErrors?.birthdate?.[0]}
      >
        <Input name="birthdate" type="date" required />
      </Field>

      <div className="pt-1">
        <Checkbox
          name="acceptTerms"
          value="on"
          required
          label="I'm 18+ and agree to the Terms and Privacy Policy."
        />
        {state.fieldErrors?.acceptTerms?.[0] && (
          <p className="mt-1 text-[0.8rem] text-danger" role="alert">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" fullWidth loading={pending} className="mt-2">
        Create account
      </Button>
    </form>
  );
}
