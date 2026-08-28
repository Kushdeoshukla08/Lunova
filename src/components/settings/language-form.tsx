"use client";

import { useActionState } from "react";
import {
  setLocaleAction,
  type LocaleResult,
} from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export function LanguageForm({
  current,
  regionNote,
}: {
  current: Locale;
  regionNote: string;
}) {
  const [state, action, pending] = useActionState<LocaleResult | null, FormData>(
    setLocaleAction,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Card>
        <CardTitle>Language</CardTitle>
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="locale" className="text-sm text-ink-soft">
            Display language
          </label>
          <select
            id="locale"
            name="locale"
            defaultValue={current}
            className="w-full rounded-[var(--radius-md)] border border-line bg-paper px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow"
          >
            {LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_LABELS[loc]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-faint">{regionNote}</p>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Save
        </Button>
        {state?.ok && (
          <span className="text-sm text-ok" role="status">
            Saved
          </span>
        )}
        {state && !state.ok && (
          <span className="text-sm text-danger">{state.error}</span>
        )}
      </div>
    </form>
  );
}
