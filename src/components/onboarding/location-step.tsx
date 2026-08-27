"use client";

import { StepForm, useStepError } from "./step-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { PRECISION_LABELS } from "@/lib/enums/labels";
import * as React from "react";

export function LocationStep({
  knownCities,
  defaults,
}: {
  knownCities: string[];
  defaults: { city: string | null; locationPrecision: string };
}) {
  const [precision, setPrecision] = React.useState(defaults.locationPrecision);
  const cityError = useStepError("city");

  return (
    <StepForm slug="location">
      <div className="flex flex-col gap-4">
        <Field
          label="City"
          required
          hint="We convert this to an approximate area. Your exact location is never stored or shown."
          error={cityError}
        >
          <Input
            name="city"
            list="known-cities"
            defaultValue={defaults.city ?? ""}
            placeholder="Lisbon"
            autoComplete="address-level2"
          />
          <datalist id="known-cities">
            {knownCities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="How precise should matching be?">
          <input type="hidden" name="locationPrecision" value={precision} />
          <RadioGroup
            name="locationPrecisionChoice"
            value={precision}
            onValueChange={setPrecision}
            options={Object.entries(PRECISION_LABELS).map(([value, label]) => ({
              value,
              label: label.split(" — ")[0],
              description: label.split(" — ")[1],
            }))}
          />
        </Field>
      </div>
    </StepForm>
  );
}
