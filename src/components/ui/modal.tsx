"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Bottom sheet on mobile, centered card on >=sm. */
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Drop the header/footer chrome and body padding — the child owns the panel. */
  bare?: boolean;
}

const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" } as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bare = false,
}: ModalProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const headingId = React.useId();
  const descId = React.useId();
  const labelledBy = title && !bare ? headingId : undefined;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={description && !bare ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        // click on the backdrop (the dialog element itself) closes
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 w-full max-w-full bg-transparent p-0 backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]",
        "fixed inset-0 max-h-none h-full",
        "open:flex open:items-end open:justify-center sm:open:items-center",
      )}
    >
      {open && (
        <div
          className={cn(
            "relative w-full bg-paper-raised shadow-[var(--shadow-lg)] border border-line",
            "rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]",
            // `overscroll-contain` stops a flick at the end of the sheet from
            // scrolling the page underneath it — the usual bottom-sheet wart.
            "max-h-[92vh] overflow-y-auto overscroll-contain",
            "motion-safe:animate-[orbit-in_var(--dur)_var(--ease-orbit)]",
            widths[size],
            className,
          )}
        >
          {bare ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full text-ink-faint hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow"
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-paper-raised/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                {title && (
                  <h2 id={headingId} className="text-lg font-display text-ink">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-0.5 text-sm text-ink-soft text-pretty">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow"
              >
                <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          )}
          <div className={bare ? "" : "px-5 py-5"}>{children}</div>
          {footer && (
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-line bg-paper-raised/95 px-5 py-4 backdrop-blur">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
