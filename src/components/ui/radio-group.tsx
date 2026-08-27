"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Card-style single-select. Used across onboarding for intent, gender, etc.
 * Renders as a real radiogroup for keyboard + screen-reader support.
 */
export function RadioGroup({
  name,
  value,
  onValueChange,
  options,
  columns = 1,
  className,
}: {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: RadioOption[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "grid gap-2.5",
        columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 " +
                "transition-[border-color,background-color] duration-[var(--dur-fast)] " +
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-glow",
              checked
                ? "border-glow bg-glow-soft/60"
                : "border-line-strong bg-paper-raised hover:border-ink-faint",
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onValueChange?.(opt.value)}
              className="mt-1 size-4 shrink-0 appearance-none rounded-full border border-line-strong checked:border-[5px] checked:border-glow"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{opt.label}</span>
              {opt.description && (
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
