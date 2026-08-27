import * as React from "react";
import { cn } from "@/lib/cn";

const pad = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof pad;
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = "md", interactive = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-paper-raised border border-line rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)]",
        pad[padding],
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-[var(--dur)] ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-line-strong",
        className,
      )}
      {...props}
    />
  );
});

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-display tracking-tight text-ink", className)}
      {...props}
    />
  );
}
