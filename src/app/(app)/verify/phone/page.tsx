import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getVerificationStatus } from "@/lib/verification/service";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhoneVerifyForm } from "@/components/verification/phone-verify-form";

export const metadata: Metadata = { title: "Verify your phone" };

export default async function VerifyPhonePage() {
  const user = await requireOnboardedUser();
  const status = await getVerificationStatus(user.id);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title="Verify your phone"
        subtitle="A verified phone helps keep Lunova free of fake accounts. We never show it and never share it."
      />
      <Card>
        {status.phoneVerified ? (
          <div className="flex items-center gap-2">
            <Badge tone="ok">Verified</Badge>
            <span className="text-sm text-ink-soft">{status.phone}</span>
          </div>
        ) : (
          <PhoneVerifyForm existingPhone={status.phone} />
        )}
      </Card>
    </div>
  );
}
