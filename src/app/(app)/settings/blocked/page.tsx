import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { storage } from "@/lib/providers/storage";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { BlockedList } from "@/components/settings/blocked-list";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Blocked people" };

export default async function BlockedSettingsPage() {
  const user = await requireUser();
  const blocks = await db.block.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      blocked: {
        select: {
          id: true,
          profile: {
            select: {
              displayName: true,
              photos: { where: { isPrimary: true }, select: { storageKey: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title="Blocked people"
        subtitle="Blocked members can't see your profile or message you, and you won't see them."
      />
      <BlockedList
        blocked={blocks.map((b) => ({
          userId: b.blocked.id,
          name: b.blocked.profile?.displayName ?? "Someone",
          photoUrl: b.blocked.profile?.photos[0]
            ? storage.publicUrl(b.blocked.profile.photos[0].storageKey)
            : null,
          at: formatRelative(b.createdAt),
        }))}
      />
    </div>
  );
}
