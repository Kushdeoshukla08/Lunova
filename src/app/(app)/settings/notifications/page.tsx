import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { NotificationsForm } from "@/components/settings/notifications-form";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const pref = await db.notificationPreference.findUnique({ where: { userId: user.id } });

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title="Notifications"
        subtitle="Choose what Lunova tells you about, and where."
      />
      <NotificationsForm
        defaults={{
          newLike: pref?.newLike ?? true,
          newMatch: pref?.newMatch ?? true,
          newMessage: pref?.newMessage ?? true,
          product: pref?.product ?? false,
          channelEmail: pref?.channelEmail ?? true,
          channelPush: pref?.channelPush ?? true,
        }}
      />
    </div>
  );
}
