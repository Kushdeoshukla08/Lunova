import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * The signature entrance — content rises a little and settles with a soft
 * spring. `index` staggers siblings. Honours prefers-reduced-motion via CSS.
 */
export function Reveal({
  children,
  index = 0,
  small = false,
  as: Tag = "div",
  className,
  ...rest
}: {
  children: React.ReactNode;
  index?: number;
  small?: boolean;
  as?: React.ElementType;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(small ? "reveal-sm" : "reveal", className)}
      style={{ ["--i" as string]: index }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
