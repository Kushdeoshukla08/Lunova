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
        // `unoptimized` is required, not a shortcut: /media authorizes each
        // request against the signed-in viewer, and the image optimizer fetches
        // server-to-server with no cookie (so it would 404) into a *shared*
        // cache (so a hit would serve one member's photo to another). Member
        // photos must never go through it. They are small and already
        // cache-controlled by the route.
        <Image src={src} alt={name} fill sizes="96px" unoptimized className="object-cover" />
      ) : (
        <span aria-hidden="true">{initials(name) || "•"}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
