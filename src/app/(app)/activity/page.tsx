import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { VISIBILITY_LABELS } from "@/lib/enums/labels";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const user = await requireOnboardedUser();
  const activity = await db.activityProfile.findFirst({
    where: { profile: { userId: user.id } },
    select: {
      preferredLifestyle: true,
      activeDaysPerWeek: true,
      consistencyNote: true,
      visibility: true,
      types: {
        select: { isFavorite: true, activityType: { select: { label: true, category: true } } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-display tracking-tight">Movement</h1>
        <p className="mt-1 text-sm text-ink-soft">
          How you like to move — a lifestyle signal, not a leaderboard.
        </p>
      </div>

      {!activity || activity.types.length === 0 ? (
        <EmptyState
          title="Add your movement identity"
          description="A few activities and the rhythm you keep. It becomes a match highlight when you and someone move the same way."
          action={
            <Link
              href="/profile/edit#activity"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Add activities
            </Link>
          }
        />
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Your movement</CardTitle>
              <Badge tone="neutral">{VISIBILITY_LABELS[activity.visibility]}</Badge>
            </div>
            {activity.preferredLifestyle && (
              <p className="mt-2 text-[0.95rem] italic text-ink text-pretty">
                “{activity.preferredLifestyle}”
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {activity.types.map((t) => (
                <span
                  key={t.activityType.label}
                  className="rounded-full bg-glow-soft px-2.5 py-0.5 text-xs text-glow-press"
                >
                  {t.activityType.label}
                </span>
              ))}
            </div>
            {activity.activeDaysPerWeek != null && (
              <p className="mt-3 text-sm text-ink-soft">
                Active roughly{" "}
                <span className="text-ink">
                  {activity.activeDaysPerWeek === 7
                    ? "most days"
                    : `${activity.activeDaysPerWeek} day${activity.activeDaysPerWeek === 1 ? "" : "s"} a week`}
                </span>
                .
              </p>
            )}
            <Link
              href="/profile/edit#activity"
              className={buttonVariants({ size: "sm", variant: "secondary", className: "mt-4" })}
            >
              Edit movement
            </Link>
          </Card>

          <Card>
            <CardTitle>What this is for</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft text-pretty">
              Lunova uses your activities to surface people who live at a similar
              pace — someone who walks is just as valid as someone who runs
              marathons. We never track pace, routes, or precise locations.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
