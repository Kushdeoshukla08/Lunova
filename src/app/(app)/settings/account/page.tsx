import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteAccount } from "@/components/settings/delete-account";

export const metadata: Metadata = { title: "Account" };

export default async function AccountSettingsPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader title="Account" subtitle="Manage your data." />

      <Card>
        <CardTitle>Download your data</CardTitle>
        <p className="mt-1 text-sm text-ink-soft text-pretty">
          Request a copy of your profile, matches and messages. We&apos;ll email
          you a link when it&apos;s ready.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Export delivery isn&apos;t wired up in this build — the request is
          recorded and the pipeline is a provider swap.
        </p>
      </Card>

      <Card className="border-danger/30">
        <CardTitle>Delete account</CardTitle>
        <p className="mt-1 text-sm text-ink-soft text-pretty">
          Permanently remove your profile and anonymise your data.
        </p>
        <div className="mt-4">
          <DeleteAccount />
        </div>
      </Card>
    </div>
  );
}
