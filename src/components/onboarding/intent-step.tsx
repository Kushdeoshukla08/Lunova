"use client";

import * as React from "react";
import { StepForm, useStepError } from "./step-form";
import { Field } from "@/components/ui/field";
import { RadioGroup } from "@/components/ui/radio-group";
import { INTENT_HINTS, INTENT_LABELS } from "@/lib/enums/labels";

export function IntentStep({ defaultValue }: { defaultValue: string | null }) {
  const [value, setValue] = React.useState(defaultValue ?? "");
  const error = useStepError("relationshipIntent");

  return (
    <StepForm slug="intent">
      <Field label="Right now, I'm looking for…" required error={error}>
        <input type="hidden" name="relationshipIntent" value={value} />
        <RadioGroup
          name="intentChoice"
          value={value}
          onValueChange={setValue}
          options={Object.keys(INTENT_LABELS).map((k) => ({
            value: k,
            label: INTENT_LABELS[k],
            description: INTENT_HINTS[k],
          }))}
        />
      </Field>
    </StepForm>
  );
}
