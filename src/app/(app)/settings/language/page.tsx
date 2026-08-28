import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { getI18n } from "@/lib/i18n/locale";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { LanguageForm } from "@/components/settings/language-form";

export const metadata: Metadata = { title: "Language & region" };

export default async function LanguageSettingsPage() {
  await requireUser();
  const { locale, timeZone, units, dict } = await getI18n();

  const regionNote =
    `${dict.settings.language.note} ` +
    `Right now: dates in ${timeZone === "UTC" ? "UTC" : timeZone}, ` +
    `distances in ${units === "imperial" ? "miles" : "kilometres"}.`;

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title={dict.settings.language.title}
        subtitle={dict.settings.language.blurb}
      />
      <LanguageForm current={locale} regionNote={regionNote} />
    </div>
  );
}
