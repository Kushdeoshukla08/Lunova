"use client";

import * as React from "react";
import { useActionState } from "react";
import { saveStepAction, type StepState } from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-message";

const StepStateContext = React.createContext<StepState>({});

/** Field-level error lookup for onboarding steps. */
export function useStepError(name: string): string | undefined {
  return React.useContext(StepStateContext).fieldErrors?.[name]?.[0];
}

export function StepForm({
  slug,
  submitLabel = "Continue",
  children,
}: {
  slug: string;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const bound = React.useMemo(() => saveStepAction.bind(null, slug), [slug]);
  const [state, action, pending] = useActionState<StepState, FormData>(bound, {});

  return (
    <StepStateContext.Provider value={state}>
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormMessage error={state.error} />
        {children}
        <Button type="submit" size="lg" fullWidth loading={pending}>
          {submitLabel}
        </Button>
      </form>
    </StepStateContext.Provider>
  );
}
