import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await requireOnboardedUser();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.displayName ?? user.email} src={user.primaryPhotoKey} size="lg" />
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            {user.displayName ?? "Your profile"}
          </h1>
          <p className="text-sm text-ink-soft">This is how you show up on Lunova.</p>
        </div>
      </div>
      <EmptyState
        title="Profile editing is the next phase"
        description="Photos, prompts, interests, music and movement — all editable, with a live preview of your discovery card."
      />
    </div>
  );
}
