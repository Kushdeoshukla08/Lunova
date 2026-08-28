import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { explainPair } from "@/lib/compatibility/explain";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Why this person" };

export default async function WhyPage(props: PageProps<"/admin/why">) {
  await requireRole("ADMIN", "MODERATOR");
  const sp = await props.searchParams;
  const viewer = str(sp.viewer);
  const candidate = str(sp.candidate);

  const result =
    viewer && candidate ? await explainPair(viewer, candidate) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Why this person?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The internal ranking breakdown for a viewer / candidate pair. Members
          never see this — they see the labels and highlight sentences only.
        </p>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            Viewer user id
            <input
              name="viewer"
              defaultValue={viewer ?? ""}
              className="w-full max-w-72 rounded-[var(--radius-md)] border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-soft">
            Candidate user id
            <input
              name="candidate"
              defaultValue={candidate ?? ""}
              className="w-full max-w-72 rounded-[var(--radius-md)] border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-ink px-4 py-2 text-sm text-paper"
          >
            Explain
          </button>
        </form>
      </Card>

      {result && "error" in result && (
        <p className="text-sm text-danger">{result.error}</p>
      )}

      {result && !("error" in result) && (
        <>
          <Card>
            <div className="flex items-baseline justify-between">
              <CardTitle>{result.label}</CardTitle>
              <span className="font-mono text-sm text-ink-soft">
                score {result.score.toFixed(3)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              Score is an internal ranking number in [0,1]. It is never shown to
              members and never rendered as a percentage.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Gate ok={result.gates.viewerAcceptsCandidate} label="viewer accepts candidate" />
              <Gate ok={result.gates.candidateAcceptsViewer} label="candidate accepts viewer" />
              <Gate ok={result.gates.mutuallyEligible} label="mutually eligible" />
              {result.distanceKm != null && (
                <span className="rounded-full bg-sand px-2 py-0.5 text-ink-soft">
                  {Math.round(result.distanceKm)} km apart
                </span>
              )}
            </div>
          </Card>

          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-faint">
                <tr className="border-b border-line">
                  <th className="px-4 py-2">Signal</th>
                  <th className="px-4 py-2">Raw</th>
                  <th className="px-4 py-2">Weight</th>
                  <th className="px-4 py-2">Contribution</th>
                  <th className="px-4 py-2">Highlight(s)</th>
                </tr>
              </thead>
              <tbody>
                {result.signals.map((s) => (
                  <tr key={s.signal} className="border-b border-line/60">
                    <td className="px-4 py-2 font-medium text-ink">{s.signal}</td>
                    <td className="px-4 py-2 font-mono text-ink-soft">{s.raw.toFixed(3)}</td>
                    <td className="px-4 py-2 font-mono text-ink-faint">{s.weight}</td>
                    <td className="px-4 py-2 font-mono text-ink">{s.contribution.toFixed(3)}</td>
                    <td className="px-4 py-2 text-ink-soft">
                      {s.highlights.length ? s.highlights.join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-ink-faint">
            Signals are the whole model. There is no hidden term for popularity,
            likes received, attractiveness, verification or spend — see
            docs/COMPATIBILITY.md.
          </p>
        </>
      )}
    </div>
  );
}

function str(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : null;
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "rounded-full bg-ok-soft px-2 py-0.5 text-ok"
          : "rounded-full bg-danger-soft px-2 py-0.5 text-danger"
      }
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}
