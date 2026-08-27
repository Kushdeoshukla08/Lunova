import { cn } from "@/lib/cn";

/** Onboarding / profile-completeness progress. */
export function Progress({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sand-strong", className)}
    >
      <div
        className="h-full rounded-full bg-glow transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-spring)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
