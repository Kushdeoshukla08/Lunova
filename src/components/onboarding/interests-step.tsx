"use client";

import { StepForm, useStepError } from "./step-form";
import { Field } from "@/components/ui/field";
import { ChipMultiSelect } from "./chip-multi-select";

export function InterestsStep({
  options,
  selected,
}: {
  options: { slug: string; label: string; category: string }[];
  selected: string[];
}) {
  const error = useStepError("interests");
  return (
    <StepForm slug="interests">
      <Field
        label="What are you into?"
        hint="Pick 5–10. These show up on your profile and give people something to open with."
        error={error}
      >
        <ChipMultiSelect
          name="interests"
          options={options}
          initial={selected}
          min={3}
          max={12}
          groupByCategory
        />
      </Field>
    </StepForm>
  );
}
