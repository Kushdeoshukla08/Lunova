"use client";

import { StepForm } from "./step-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ChipMultiSelect } from "./chip-multi-select";
import { TagInput } from "./tag-input";

const GENRES = [
  "Pop", "Indie", "Rock", "Hip-hop", "R&B", "Electronic", "House", "Techno",
  "Jazz", "Soul", "Folk", "Classical", "Ambient", "Punk", "Metal", "Country",
  "Afrobeats", "Latin", "K-pop", "Lo-fi", "Bollywood", "Reggae",
].map((g) => ({ slug: g, label: g }));

export function MusicStep({
  defaults,
}: {
  defaults: { listeningMood: string; topGenres: string[]; artists: string[] };
}) {
  return (
    <StepForm slug="music">
      <div className="flex flex-col gap-4">
        <Field
          label="What's your listening lately?"
          hint="Optional — the vibe, not a playlist. e.g. “late-night drives”, “gym energy”."
        >
          <Input
            name="listeningMood"
            defaultValue={defaults.listeningMood}
            maxLength={120}
            placeholder="Slow mornings and one very specific sad playlist"
          />
        </Field>

        <Field label="Genres you keep coming back to" hint="Up to 6.">
          <ChipMultiSelect
            name="topGenres"
            options={GENRES}
            initial={defaults.topGenres}
            max={6}
          />
        </Field>

        <Field
          label="Artists on repeat"
          hint="Type a name and press Enter. Up to 8. Shared artists become a match highlight."
        >
          <TagInput
            name="artists"
            initial={defaults.artists}
            max={8}
            placeholder="Add an artist…"
          />
        </Field>
      </div>
    </StepForm>
  );
}
