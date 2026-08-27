import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "glow" | "moonlight" | "ok" | "warn" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft",
  glow: "bg-glow-soft text-glow-press",
  moonlight: "bg-moonlight-soft text-moonlight",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  outline: "border border-line-strong text-ink-soft",
};

export function Badge({
  tone = "neutral",
  className,
  icon,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Trust signal shown on profiles. Only ever shows *safe* positive states. */
export function VerifiedBadge({
  label = "Verified",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      tone="moonlight"
      className={className}
      icon={
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 1.6 9.9 3l2.3-.2.6 2.2 1.8 1.5-1 2.1.4 2.3-2.2.7L8.9 14 8 12l-1 .1L6 14l-2.4-2.1-2.2-.7.4-2.3-1-2.1L2.6 5l.6-2.2L5.5 3z"
          />
          <path
            fill="var(--paper-raised)"
            d="m6.9 9.7-1.7-1.7.9-.9.8.8 2.3-2.3.9.9z"
          />
        </svg>
      }
    >
      {label}
    </Badge>
  );
}
