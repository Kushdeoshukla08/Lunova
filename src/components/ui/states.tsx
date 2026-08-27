import * as React from "react";
import { cn } from "@/lib/cn";

interface StateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Calm empty state — a prompt to act, never a dead end. */
export function EmptyState({ title, description, icon, action, className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-sand/40 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && <div className="text-ink-faint [&_svg]:size-8">{icon}</div>}
      <h3 className="text-lg font-display text-ink">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Recoverable error — always offers a way forward. */
export function ErrorState({
  title = "Something went sideways",
  description = "That didn't load. Give it another try.",
  action,
  className,
}: Partial<StateProps>) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-danger/30 bg-danger-soft/50 px-6 py-12 text-center",
        className,
      )}
    >
      <h3 className="text-lg font-display text-ink">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-ink-soft text-pretty">
        {description}
      </p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
