"use client";

import * as React from "react";
import { StepForm, useStepError } from "./step-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipMultiSelect } from "./chip-multi-select";
import { GENDER_LABELS } from "@/lib/enums/labels";

const GENDER_OPTIONS = Object.entries(GENDER_LABELS)
  .filter(([v]) => v !== "PREFER_NOT_TO_SAY")
  .map(([slug, label]) => ({ slug, label }));

export function PreferencesStep({
  defaults,
}: {
  defaults: {
    minAge: number;
    maxAge: number;
    maxDistanceKm: number;
    genders: string[];
    globalMode: boolean;
  };
}) {
  const [globalMode, setGlobalMode] = React.useState(defaults.globalMode);
  const maxAgeError = useStepError("maxAge");
  const minAgeError = useStepError("minAge");
  const distanceError = useStepError("maxDistanceKm");

  return (
    <StepForm slug="preferences">
      <div className="flex flex-col gap-5">
        <Field label="Age range" error={maxAgeError ?? minAgeError}>
          <div className="flex items-center gap-3">
            <Input
              name="minAge"
              type="number"
              min={18}
              max={100}
              defaultValue={defaults.minAge}
              className="w-24"
              aria-label="Minimum age"
            />
            <span className="text-ink-faint">to</span>
            <Input
              name="maxAge"
              type="number"
              min={18}
              max={100}
              defaultValue={defaults.maxAge}
              className="w-24"
              aria-label="Maximum age"
            />
          </div>
        </Field>

        <Field
          label="Maximum distance"
          error={distanceError}
          hint={globalMode ? "Global mode is on — distance is ignored." : undefined}
        >
          <div className="flex items-center gap-3">
            <Input
              name="maxDistanceKm"
              type="number"
              min={1}
              max={500}
              defaultValue={defaults.maxDistanceKm}
              className="w-28"
              disabled={globalMode}
            />
            <span className="text-sm text-ink-faint">km</span>
          </div>
        </Field>

        <Checkbox
          name="globalMode"
          value="on"
          defaultChecked={defaults.globalMode}
          onChange={(e) => setGlobalMode(e.currentTarget.checked)}
          label="Show me people anywhere in the world"
        />

        <Field
          label="Open to"
          hint="Leave empty to be shown everyone."
        >
          <ChipMultiSelect
            name="genders"
            options={GENDER_OPTIONS}
            initial={defaults.genders}
          />
        </Field>
      </div>
    </StepForm>
  );
}
