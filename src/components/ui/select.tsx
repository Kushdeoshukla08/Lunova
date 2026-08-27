"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  const field = useFieldControl();
  return (
    <span className="relative block">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none h-11 pl-3.5 pr-10 text-[0.95rem] bg-paper-raised text-ink " +
            "border border-line-strong rounded-[var(--radius-md)] " +
            "focus:outline-none focus-visible:border-glow focus-visible:ring-4 focus-visible:ring-glow-ring/40 " +
            "aria-[invalid=true]:border-danger disabled:opacity-60",
          className,
        )}
        {...field}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        aria-hidden="true"
      >
        <path
          d="M6 8l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  );
});
