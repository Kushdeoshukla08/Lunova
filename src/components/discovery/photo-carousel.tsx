"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/** Tap left/right thirds to page; dots show position. Keyboard: ← →. */
export function PhotoCarousel({
  photos,
  alt,
  overlay,
}: {
  photos: { id: string; url: string }[];
  alt: string;
  overlay?: React.ReactNode;
}) {
  const [i, setI] = React.useState(0);
  const count = photos.length || 1;
  const go = (d: number) => setI((p) => (p + d + count) % count);

  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden rounded-[var(--radius-lg)] bg-sand"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt}, photo ${i + 1} of ${count}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      tabIndex={0}
    >
      {photos[i] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photos[i].url}
          alt={`${alt} — photo ${i + 1}`}
          className="size-full object-cover"
          draggable={false}
        />
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute inset-y-0 left-0 w-1/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper"
          />
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute inset-y-0 right-0 w-1/3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper"
          />
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center gap-1 px-3">
            {photos.map((p, idx) => (
              <span
                key={p.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  idx === i ? "bg-paper" : "bg-paper/40",
                )}
              />
            ))}
          </div>
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 via-ink/20 to-transparent p-4">
        <div className="pointer-events-auto">{overlay}</div>
      </div>
    </div>
  );
}
