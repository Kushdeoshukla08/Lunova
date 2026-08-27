"use client";

import { StepForm, useStepError } from "./step-form";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  GENDER_LABELS,
  ORIENTATION_LABELS,
  toOptions,
} from "@/lib/enums/labels";

export function BasicsStep({
  defaults,
}: {
  defaults: {
    displayName: string | null;
    gender: string;
    pronouns: string | null;
    orientation: string | null;
    bio: string | null;
    heightCm: number | null;
  };
}) {
  return (
    <StepForm slug="basics">
      <Body defaults={defaults} />
    </StepForm>
  );
}

function Body({ defaults }: { defaults: Parameters<typeof BasicsStep>[0]["defaults"] }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="First name / nickname" required error={useStepError("displayName")}>
        <Input
          name="displayName"
          defaultValue={defaults.displayName ?? ""}
          maxLength={40}
          autoComplete="given-name"
          placeholder="Maya"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gender" required error={useStepError("gender")}>
          <Select name="gender" defaultValue={defaults.gender}>
            {toOptions(GENDER_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pronouns" hint="Optional — shown on your profile.">
          <Input
            name="pronouns"
            defaultValue={defaults.pronouns ?? ""}
            maxLength={30}
            placeholder="she/her"
          />
        </Field>
      </div>

      <Field label="Orientation" hint="Optional.">
        <Select name="orientation" defaultValue={defaults.orientation ?? ""}>
          <option value="">Prefer not to say</option>
          {toOptions(ORIENTATION_LABELS)
            .filter((o) => o.value !== "PREFER_NOT_TO_SAY")
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </Select>
      </Field>

      <Field
        label="A short intro"
        hint="Optional. One or two sentences that sound like you."
        error={useStepError("bio")}
      >
        <Textarea
          name="bio"
          defaultValue={defaults.bio ?? ""}
          maxLength={600}
          rows={3}
          placeholder="Slow mornings, long walks, and I will absolutely talk your ear off about film photography."
        />
      </Field>

      <Field label="Height (cm)" hint="Optional." error={useStepError("heightCm")}>
        <Input
          name="heightCm"
          type="number"
          inputMode="numeric"
          min={120}
          max={230}
          defaultValue={defaults.heightCm ?? ""}
          className="max-w-32"
        />
      </Field>
    </div>
  );
}
