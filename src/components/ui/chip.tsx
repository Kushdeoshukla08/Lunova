"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Selectable pill — used for interests, activity types, discovery filters.
 * Controlled: parent owns `selected` and handles `onSelectedChange`.
 */
export interface ChipProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, onSelectedChange, className, children, onClick, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={selected}
      onClick={(e) => {
        onClick?.(e);
        onSelectedChange?.(!selected);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium " +
          "transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-spring)] " +
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow active:scale-[0.97]",
        selected
          ? "bg-ink text-paper border-ink"
          : "bg-paper-raised text-ink-soft border-line-strong hover:border-ink-faint hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
