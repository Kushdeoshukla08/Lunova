import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-ink-soft">
          How you like to move — a lifestyle signal, not a leaderboard.
        </p>
      </div>
      <EmptyState
        title="Your movement identity"
        description="Favourite activities, rhythm and what you'd love company for. This is built in the activity phase."
      />
    </div>
  );
}
