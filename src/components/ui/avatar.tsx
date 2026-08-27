import Image from "next/image";
import { cn } from "@/lib/cn";

const sizeMap = {
  xs: "size-6 text-[0.6rem]",
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-16 text-base",
  xl: "size-24 text-xl",
} as const;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  src,
  size = "md",
  verified = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizeMap;
  verified?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-grid place-items-center shrink-0 rounded-full overflow-hidden bg-sand-strong text-ink-soft font-medium",
        verified && "ring-2 ring-moonlight ring-offset-2 ring-offset-paper",
        sizeMap[size],
        className,
      )}
    >
      {src ? (
        <Image src={src} alt={name} fill sizes="96px" className="object-cover" />
      ) : (
        <span aria-hidden="true">{initials(name) || "•"}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
