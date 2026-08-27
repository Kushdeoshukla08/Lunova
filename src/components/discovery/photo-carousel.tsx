"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Photo viewer for the discovery card. Tap the left/right third to page, swipe
 * on touch, or use ← →. Photos crossfade. Progress segments sit at the top.
 */
export function PhotoCarousel({
  photos,
  alt,
  overlay,
  className,
}: {
  photos: { id: string; url: string; blurhash?: string | null }[];
  alt: string;
  overlay?: React.ReactNode;
  className?: string;
}) {
  const [i, setI] = React.useState(0);
  const count = Math.max(photos.length, 1);
  const go = React.useCallback(
    (d: number) => setI((p) => (p + d + count) % count),
    [count],
  );

  const touch = React.useRef<{ x: number; t: number } | null>(null);

  return (
    <div
      className={cn(
        "group relative aspect-[4/5] w-full select-none overflow-hidden rounded-[var(--radius-lg)] bg-sand-strong",
        className,
      )}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt} — photo ${i + 1} of ${count}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onTouchStart={(e) => {
        touch.current = { x: e.touches[0].clientX, t: Date.now() };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        if (Math.abs(dx) > 40 && Date.now() - start.t < 600) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      {photos.map((p, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={p.url}
          alt={idx === i ? `${alt}, photo ${idx + 1}` : ""}
          aria-hidden={idx === i ? undefined : true}
          draggable={false}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-[var(--dur)] ease-[var(--ease-orbit)]",
            idx === i ? "opacity-100" : "opacity-0",
          )}
        />
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute inset-y-0 left-0 z-10 w-1/3 outline-none focus-visible:bg-paper/5"
          />
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 z-10 w-1/3 outline-none focus-visible:bg-paper/5"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 p-2.5">
            {photos.map((p, idx) => (
              <span
                key={p.id}
                className={cn(
                  "h-[3px] flex-1 rounded-full transition-colors",
                  idx === i ? "bg-paper" : "bg-paper/35",
                )}
              />
            ))}
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent px-4 pb-4 pt-16">
        <div className="pointer-events-auto">{overlay}</div>
      </div>
    </div>
  );
}
