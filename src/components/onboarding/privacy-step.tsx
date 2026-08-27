"use client";

import { StepForm } from "./step-form";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { VISIBILITY_LABELS, toOptions } from "@/lib/enums/labels";

export function PrivacyStep({
  defaults,
}: {
  defaults: {
    musicVisibility: string;
    activityVisibility: string;
    showActiveStatus: boolean;
    incognito: boolean;
  };
}) {
  return (
    <StepForm slug="privacy" submitLabel="Finish & start discovering">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-ink-soft text-pretty">
          Sensible defaults are already set — this is just a quick review. You can
          change all of it any time in Settings.
        </p>

        <Field label="Who can see your music" >
          <Select name="musicVisibility" defaultValue={defaults.musicVisibility}>
            {toOptions(VISIBILITY_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Who can see your activity">
          <Select name="activityVisibility" defaultValue={defaults.activityVisibility}>
            {toOptions(VISIBILITY_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <Checkbox
            name="showActiveStatus"
            value="on"
            defaultChecked={defaults.showActiveStatus}
            label="Show when I was last active"
          />
          <Checkbox
            name="incognito"
            value="on"
            defaultChecked={defaults.incognito}
            label="Incognito — only people I've liked can see me"
          />
        </div>

        <p className="text-xs text-ink-faint">
          Lunova never shows your exact location, and safety tools (block, report,
          unmatch) are always available and always free.
        </p>
      </div>
    </StepForm>
  );
}
