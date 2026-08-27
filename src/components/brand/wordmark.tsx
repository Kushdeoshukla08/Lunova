import Link from "next/link";
import { cn } from "@/lib/cn";

/** Lunova wordmark — a crescent inside a light orbit, set with the display serif. */
export function Wordmark({
  href = "/",
  className,
}: {
  href?: string | null;
  className?: string;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LunovaMark className="size-6" />
      <span className="font-display text-xl tracking-tight text-ink">Lunova</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow" aria-label="Lunova home">
      {inner}
    </Link>
  );
}

export function LunovaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="var(--moonlight)"
        strokeOpacity="0.5"
        strokeWidth="1.25"
      />
      <path
        d="M15.5 5.5a7 7 0 1 0 3 8.2A5.6 5.6 0 0 1 15.5 5.5Z"
        fill="var(--glow)"
      />
    </svg>
  );
}
