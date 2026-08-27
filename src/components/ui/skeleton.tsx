import { cn } from "@/lib/cn";

/** Content placeholder. Pair with `aria-hidden` regions and a visually-hidden
 *  "Loading" status handled by the parent. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-[var(--radius-sm)] bg-sand-strong/70",
        className,
      )}
    />
  );
}
