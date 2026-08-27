"use client";

import { StepForm } from "./step-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChipMultiSelect } from "./chip-multi-select";

export function ActivityStep({
  options,
  defaults,
}: {
  options: { slug: string; label: string; category: string }[];
  defaults: {
    preferredLifestyle: string;
    activeDaysPerWeek: number | null;
    types: string[];
  };
}) {
  return (
    <StepForm slug="activity">
      <div className="flex flex-col gap-4">
        <Field
          label="How would you describe how you move?"
          hint="Optional. Lifestyle, not stats — e.g. “early morning trails”, “slow weekends, long walks”."
        >
          <Input
            name="preferredLifestyle"
            defaultValue={defaults.preferredLifestyle}
            maxLength={120}
            placeholder="Weeknight run club, weekend hikes, terrible at rest days"
          />
        </Field>

        <Field label="Roughly how many active days a week?" hint="Optional, and kept vague on purpose.">
          <Select
            name="activeDaysPerWeek"
            defaultValue={defaults.activeDaysPerWeek?.toString() ?? ""}
            className="max-w-40"
          >
            <option value="">Prefer not to say</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n === 7 ? "Most days" : `${n} day${n === 1 ? "" : "s"}`}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="What do you actually do?" hint="Pick what fits. Up to 8. Shared activities become a match highlight.">
          <ChipMultiSelect
            name="activityTypes"
            options={options}
            initial={defaults.types}
            max={8}
            groupByCategory
          />
        </Field>
      </div>
    </StepForm>
  );
}
