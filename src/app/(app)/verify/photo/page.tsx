import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getVerificationStatus } from "@/lib/verification/service";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhotoVerifyForm } from "@/components/verification/photo-verify-form";

export const metadata: Metadata = { title: "Photo verification" };

export default async function VerifyPhotoPage() {
  const user = await requireOnboardedUser();
  const status = await getVerificationStatus(user.id);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSectionHeader
        title="Photo verification"
        subtitle="A quick selfie confirms your photos are really you. It's compared to your profile, then deleted — it never appears anywhere."
      />

      <Card>
        {status.photo === "approved" ? (
          <div className="flex items-center gap-2">
            <Badge tone="moonlight">Photo verified</Badge>
            <span className="text-sm text-ink-soft">You&apos;re all set.</span>
          </div>
        ) : status.photo === "pending" ? (
          <div className="flex flex-col gap-1">
            <Badge tone="warn">In review</Badge>
            <p className="text-sm text-ink-soft">
              We&apos;re checking your selfie — this usually takes a few minutes.
            </p>
          </div>
        ) : (
          <PhotoVerifyForm rejected={status.photo === "rejected"} />
        )}
      </Card>

      <div className="rounded-[var(--radius-md)] bg-sand px-4 py-3 text-xs text-ink-soft">
        <p className="font-medium text-ink">How it&apos;s handled</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Your selfie is stored only until the check completes, then removed.</li>
          <li>It is never shown on your profile or to anyone else.</li>
          <li>Only a yes/no result and the date are kept.</li>
        </ul>
      </div>
    </div>
  );
}
