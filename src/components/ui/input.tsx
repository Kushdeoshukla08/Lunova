"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";

const control =
  "w-full bg-paper-raised text-ink placeholder:text-ink-faint " +
  "border border-line-strong rounded-[var(--radius-md)] " +
  "transition-[border-color,box-shadow] duration-[var(--dur-fast)] " +
  "focus:outline-none focus-visible:border-glow focus-visible:ring-4 focus-visible:ring-glow-ring/40 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  const field = useFieldControl();
  return (
    <input
      ref={ref}
      className={cn(control, "h-11 px-3.5 text-[0.95rem]", className)}
      {...field}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
  const field = useFieldControl();
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(control, "px-3.5 py-2.5 text-[0.95rem] resize-y min-h-[5rem]", className)}
      {...field}
      {...props}
    />
  );
});
