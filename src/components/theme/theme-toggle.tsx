"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Mode = "light" | "dark" | "system";

const EVT = "lunova-theme-change";

function readMode(): Mode {
  try {
    const v = localStorage.getItem("lunova-theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function setMode(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;
  try {
    localStorage.setItem("lunova-theme", mode);
  } catch {
    /* storage unavailable — the choice just won't persist */
  }
  window.dispatchEvent(new Event(EVT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const mode = React.useSyncExternalStore(subscribe, readMode, () => "system" as Mode);

  const order: Mode[] = ["system", "light", "dark"];
  const next = () => setMode(order[(order.indexOf(mode) + 1) % order.length]);

  const icon = mode === "dark" ? "☾" : mode === "light" ? "☀" : "◐";

  return (
    <button
      type="button"
      onClick={next}
      className={cn(
        "grid size-9 place-items-center rounded-full border border-line-strong text-ink-soft hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow",
        className,
      )}
      aria-label={`Theme: ${mode}. Click to change.`}
      title={`Theme: ${mode}`}
    >
      <span aria-hidden="true" className="text-[0.95rem] leading-none">
        {icon}
      </span>
    </button>
  );
}
