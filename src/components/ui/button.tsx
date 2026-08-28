import * as React from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none " +
  "transition-[transform,background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-spring)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow " +
  "disabled:pointer-events-none disabled:opacity-55 active:scale-[0.985]";

const variants: Record<Variant, string> = {
  primary:
    "bg-glow text-on-glow shadow-sm hover:bg-glow-press hover:shadow-md",
  secondary:
    "bg-paper-raised text-ink border border-line-strong hover:border-ink-faint hover:bg-sand",
  ghost: "bg-transparent text-ink hover:bg-sand",
  subtle: "bg-sand text-ink hover:bg-sand-strong",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-[var(--radius-sm)]",
  md: "h-11 px-5 text-[0.95rem] rounded-[var(--radius-md)]",
  lg: "h-13 px-7 text-base rounded-[var(--radius-lg)] [--h:3.25rem] h-[var(--h)]",
};

export function buttonVariants(opts?: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}) {
  const { variant = "primary", size = "md", fullWidth, className } = opts ?? {};
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant, size, fullWidth, loading, disabled, className, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonVariants({ variant, size, fullWidth, className })}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner className="size-[1.15em]" />
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-2",
            loading && "invisible",
          )}
        >
          {children}
        </span>
      </button>
    );
  },
);
