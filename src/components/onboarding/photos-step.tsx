"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  deletePhotoAction,
  setPrimaryPhotoAction,
  uploadPhotoAction,
  type StepState,
} from "@/lib/onboarding/actions";
import { StepForm } from "./step-form";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { FormMessage } from "@/components/auth/form-message";

type Photo = { id: string; url: string; isPrimary: boolean; pending: boolean };

export function PhotosStep({ photos }: { photos: Photo[] }) {
  const [state, upload, uploading] = useActionState<StepState, FormData>(
    uploadPhotoAction,
    {},
  );
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canAddMore = photos.length < 6;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p) => (
          <div
            key={p.id}
            className="group relative aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] border border-line bg-sand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="size-full object-cover" />
            {p.isPrimary && (
              <span className="absolute left-1.5 top-1.5">
                <Badge tone="glow">Main</Badge>
              </span>
            )}
            {p.pending && (
              <span className="absolute right-1.5 top-1.5">
                <Badge tone="warn">In review</Badge>
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/55 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {!p.isPrimary && (
                <form action={setPrimaryPhotoAction}>
                  <input type="hidden" name="photoId" value={p.id} />
                  <button className="rounded bg-paper-raised/90 px-1.5 py-0.5 text-[0.7rem] font-medium text-ink">
                    Set main
                  </button>
                </form>
              )}
              <form action={deletePhotoAction} className="ml-auto">
                <input type="hidden" name="photoId" value={p.id} />
                <button
                  aria-label="Remove photo"
                  className="rounded bg-paper-raised/90 px-1.5 py-0.5 text-[0.7rem] font-medium text-danger"
                >
                  Remove
                </button>
              </form>
            </div>
          </div>
        ))}

        {canAddMore && (
          <form
            action={upload}
            className="aspect-[3/4]"
          >
            <input
              ref={fileRef}
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                if (e.currentTarget.files?.length) e.currentTarget.form?.requestSubmit();
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex size-full flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-line-strong text-ink-faint hover:border-ink-faint hover:text-ink-soft disabled:opacity-60"
            >
              {uploading ? (
                <Spinner />
              ) : (
                <>
                  <span className="text-xl leading-none">+</span>
                  <span className="text-[0.7rem]">Add photo</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <FormMessage error={state.error} />
      <p className="text-xs text-ink-faint">
        JPEG, PNG, WebP or AVIF · up to 8 MB · {photos.length}/6 added. Your first
        photo is your main one — drag order and cropping come later.
      </p>

      <StepForm slug="photos">
        <p className="text-sm text-ink-soft">
          {photos.length === 0
            ? "Add at least one photo to continue."
            : "Looking good. You can always change these later."}
        </p>
      </StepForm>
    </div>
  );
}
