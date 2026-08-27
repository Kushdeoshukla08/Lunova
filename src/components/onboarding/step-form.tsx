"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  saveStepAction,
  type StepMode as StepModeValue,
  type StepState,
} from "@/lib/onboarding/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-message";

const StepStateContext = React.createContext<StepState>({});
const StepModeContext = React.createContext<StepModeValue>("onboarding");

/** Wrap edit-mode sections so their StepForms save-in-place instead of advancing. */
export function StepMode({
  value,
  children,
}: {
  value: StepModeValue;
  children: React.ReactNode;
}) {
  return <StepModeContext.Provider value={value}>{children}</StepModeContext.Provider>;
}

/** Field-level error lookup for onboarding steps. */
export function useStepError(name: string): string | undefined {
  return React.useContext(StepStateContext).fieldErrors?.[name]?.[0];
}

export function StepForm({
  slug,
  submitLabel,
  children,
}: {
  slug: string;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  const mode = React.useContext(StepModeContext);
  const bound = React.useMemo(
    () => saveStepAction.bind(null, slug, mode),
    [slug, mode],
  );
  const [state, action, pending] = useActionState<StepState, FormData>(bound, {});
  const label = submitLabel ?? (mode === "edit" ? "Save" : "Continue");

  return (
    <StepStateContext.Provider value={state}>
      <form action={action} className="flex flex-col gap-5" noValidate>
        <FormMessage error={state.error} />
        {children}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size={mode === "edit" ? "md" : "lg"}
            fullWidth={mode !== "edit"}
            loading={pending}
          >
            {label}
          </Button>
          {mode === "edit" && state.saved && !pending && (
            <span className="text-sm text-ok" role="status">
              Saved
            </span>
          )}
        </div>
      </form>
    </StepStateContext.Provider>
  );
}
