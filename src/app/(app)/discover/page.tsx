import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getDiscoveryFeed } from "@/lib/discovery/service";
import { DiscoveryDeck } from "@/components/discovery/discovery-deck";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const user = await requireOnboardedUser();
  const profiles = await getDiscoveryFeed(user.id, { limit: 15 });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-ink-soft">
          People you might genuinely connect with — and why.
        </p>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          title="No one new right now"
          description="We didn't find anyone matching your preferences today. Widening your age range or distance usually helps — new people join all the time."
          action={
            <Link href="/settings" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Adjust preferences
            </Link>
          }
        />
      ) : (
        <DiscoveryDeck profiles={profiles} />
      )}
    </div>
  );
}
