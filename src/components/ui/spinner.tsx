import { cn } from "@/lib/cn";

/** Indeterminate loading indicator. Inherits color via `currentColor`. */
export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block size-4 animate-spin", className)}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-full">
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.22"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
