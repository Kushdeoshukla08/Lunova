import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Connections" };

export default function ConnectionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-ink-soft">Your matches and conversations.</p>
      </div>
      <EmptyState
        title="No connections yet"
        description="When you and someone both say yes, you'll find them here with something to talk about."
      />
    </div>
  );
}
