import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { getProductSnapshot } from "@/lib/observability/product";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Product health" };

export default async function AdminMetricsPage(
  props: PageProps<"/admin/metrics">,
) {
  await requireRole("ADMIN", "MODERATOR");
  const sp = await props.searchParams;
  const windowDays = clampWindow(sp.window);
  const s = await getProductSnapshot(windowDays);

  const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display tracking-tight">Product health</h1>
        <nav className="flex gap-2 text-sm">
          {[7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/admin/metrics?window=${d}`}
              className={
                d === windowDays
                  ? "rounded-full bg-sand px-3 py-1 text-ink"
                  : "rounded-full px-3 py-1 text-ink-soft hover:bg-sand/60"
              }
            >
              {d}d
            </a>
          ))}
        </nav>
      </div>

      <Card className="border-glow/30">
        <CardTitle>Meaningful Connection Rate — the north star</CardTitle>
        <p className="mt-2 text-4xl font-display text-ink">{pct(s.meaningfulConnectionRate)}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {s.meaningfulConnections} of {s.matches} matches in the last {s.windowDays} days became a
          real two-way conversation — both people spoke, six or more messages, within two weeks.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          This is the only number we optimise for. Not swipes, not sessions, not match count.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Signups" value={s.signups} />
        <Stat label="Onboarding completed" value={pct(s.onboardingCompletionRate)} />
        <Stat label="Likes sent" value={s.likesSent} />
        <Stat label="Matches" value={s.matches} />
        <Stat label="Like → match rate" value={pct(s.matchRate)} />
        <Stat label="Conversations started" value={s.conversationsStarted} />
        <Stat label="Match → conversation" value={pct(s.conversationStartRate)} />
        <Stat label="Reports" value={s.reports} />
        <Stat label="Blocks" value={s.blocks} />
        <Stat label="Reports / 1k matches" value={s.reportsPer1kMatches} />
      </div>

      <p className="text-xs text-ink-faint">
        Every figure is an aggregate over all members in the window. There is no per-person
        breakdown here by design — see docs/OBSERVABILITY.md.
      </p>
    </div>
  );
}

function clampWindow(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return [7, 30, 90].includes(n) ? n : 30;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-display text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </Card>
  );
}
