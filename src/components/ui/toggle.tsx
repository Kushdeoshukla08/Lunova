"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--dur-fast)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow disabled:opacity-50",
        checked ? "bg-glow" : "bg-sand-strong",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 translate-x-0.5 rounded-full bg-paper-raised shadow-[var(--shadow-sm)] transition-transform duration-[var(--dur-fast)]",
          checked && "translate-x-[1.4rem]",
        )}
      />
    </button>
  );
}

/** Toggle bound to a Server Action, with optimistic state + a subtle error line. */
export function ActionToggle({
  initial,
  action,
  label,
  description,
}: {
  initial: boolean;
  action: (v: boolean) => Promise<{ ok: true; value: boolean } | { ok: false; error: string }>;
  label: string;
  description?: string;
}) {
  const [on, setOn] = React.useState(initial);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const id = React.useId();

  const toggle = (v: boolean) => {
    setOn(v);
    setError(undefined);
    start(async () => {
      const res = await action(v);
      if (!res.ok) {
        setOn(!v);
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</p>
        )}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </div>
      <Toggle id={id} checked={on} onChange={toggle} disabled={pending} label={label} />
    </div>
  );
}
