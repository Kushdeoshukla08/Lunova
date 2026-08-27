"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }
>(function Checkbox({ label, className, id, ...props }, ref) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <span className="inline-flex items-start gap-2.5">
      <span className="relative mt-0.5 inline-grid size-[1.15rem] shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "peer size-full appearance-none rounded-[6px] border border-line-strong bg-paper-raised " +
              "checked:bg-glow checked:border-glow transition-colors duration-[var(--dur-fast)] " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow",
            className,
          )}
          {...props}
        />
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute size-3 opacity-0 transition-opacity peer-checked:opacity-100"
          aria-hidden="true"
        >
          <path
            d="M13 4.5 6.5 11 3 7.5"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </span>
      {label && (
        <label htmlFor={inputId} className="text-sm text-ink leading-relaxed">
          {label}
        </label>
      )}
    </span>
  );
});
