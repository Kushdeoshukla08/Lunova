"use client";

import { useActionState } from "react";
import { updatePrivacyAction, type SettingsResult } from "@/lib/settings/actions";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { VISIBILITY_LABELS, toOptions } from "@/lib/enums/labels";

const PROFILE_VIS = {
  DISCOVERABLE: "Discoverable — shown in Discover",
  LIMITED: "Limited — only people I've liked can find me",
  PAUSED: "Paused — not shown to anyone new",
};

export function PrivacyForm({
  defaults,
}: {
  defaults: {
    profileVisibility: string;
    musicVisibility: string;
    activityVisibility: string;
    distanceVisibility: string;
    showActiveStatus: boolean;
    showAgeExact: boolean;
  };
}) {
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    updatePrivacyAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Card>
        <CardTitle>Your profile</CardTitle>
        <Field label="Profile visibility" className="mt-3">
          <Select name="profileVisibility" defaultValue={defaults.profileVisibility}>
            {toOptions(PROFILE_VIS).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card>
        <CardTitle>What people can see</CardTitle>
        <div className="mt-3 flex flex-col gap-4">
          <Field label="Music">
            <Select name="musicVisibility" defaultValue={defaults.musicVisibility}>
              {toOptions(VISIBILITY_LABELS).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Movement / activity">
            <Select name="activityVisibility" defaultValue={defaults.activityVisibility}>
              {toOptions(VISIBILITY_LABELS).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Approximate distance" hint="Your exact location is never shown, regardless.">
            <Select name="distanceVisibility" defaultValue={defaults.distanceVisibility}>
              <option value="PUBLIC">Show approximate distance</option>
              <option value="PRIVATE">Hide distance</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <Checkbox name="showAgeExact" value="on" defaultChecked={defaults.showAgeExact} label="Show my exact age" />
          <Checkbox name="showActiveStatus" value="on" defaultChecked={defaults.showActiveStatus} label="Show when I was last active" />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>Save</Button>
        {state?.ok && <span className="text-sm text-ok" role="status">Saved</span>}
        {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
