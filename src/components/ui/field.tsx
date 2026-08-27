"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type FieldContextValue = {
  id: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Wire an input to its label, hint and error message with correct ARIA. */
export function useFieldControl() {
  const ctx = React.useContext(FieldContext);
  if (!ctx) return {};
  return {
    id: ctx.id,
    "aria-invalid": ctx.invalid || undefined,
    "aria-describedby":
      [ctx.errorId, ctx.descriptionId].filter(Boolean).join(" ") || undefined,
    "aria-required": ctx.required || undefined,
  } as const;
}

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Hide the visual label but keep it for screen readers. */
  labelHidden?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  labelHidden = false,
  className,
  children,
}: FieldProps) {
  const id = React.useId();
  const descriptionId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const invalid = Boolean(error);

  return (
    <FieldContext.Provider
      value={{ id, descriptionId, errorId, invalid, required }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-sm font-medium text-ink",
              labelHidden && "sr-only",
            )}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-glow" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        {children}
        {hint && !error && (
          <p id={descriptionId} className="text-[0.8rem] leading-snug text-ink-faint">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="text-[0.8rem] leading-snug text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
