import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { PrivacyForm } from "@/components/settings/privacy-form";

export const metadata: Metadata = { title: "Privacy & visibility" };

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const p = await db.privacySetting.findUnique({ where: { userId: user.id } });

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title="Privacy & visibility"
        subtitle="You decide what's shared and with whom. Lunova never shows your exact location or contact details."
      />
      <PrivacyForm
        defaults={{
          profileVisibility: p?.profileVisibility ?? "DISCOVERABLE",
          musicVisibility: p?.musicVisibility ?? "PUBLIC",
          activityVisibility: p?.activityVisibility ?? "CONNECTIONS",
          distanceVisibility: p?.distanceVisibility ?? "PUBLIC",
          showActiveStatus: p?.showActiveStatus ?? true,
          showAgeExact: p?.showAgeExact ?? true,
        }}
      />
    </div>
  );
}
