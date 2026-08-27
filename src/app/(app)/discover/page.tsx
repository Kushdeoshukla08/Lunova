import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-ink-soft">
          People you might genuinely connect with.
        </p>
      </div>
      <EmptyState
        title="Discovery is the next phase"
        description="The hero experience — story-style profiles with music, movement and compatibility highlights — is being built next."
      />
    </div>
  );
}
