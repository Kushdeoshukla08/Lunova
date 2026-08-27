import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getPublicProfile } from "@/lib/profile/view";
import { PhotoCarousel } from "@/components/discovery/photo-carousel";
import { VerifiedBadge } from "@/components/ui/badge";
import { SafetyMenu } from "@/components/safety/safety-menu";
import { INTENT_LABELS } from "@/lib/enums/labels";

export async function generateMetadata(
  props: PageProps<"/u/[userId]">,
): Promise<Metadata> {
  const { userId } = await props.params;
  const me = await requireOnboardedUser();
  const p = await getPublicProfile(me.id, userId);
  return { title: p ? p.name : "Profile" };
}

export default async function PublicProfilePage(props: PageProps<"/u/[userId]">) {
  const { userId } = await props.params;
  const me = await requireOnboardedUser();
  const p = await getPublicProfile(me.id, userId);
  if (!p) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-display tracking-tight">
            {p.name}, {p.age}
            {p.verified.photo && <VerifiedBadge label="" />}
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {[p.pronouns, p.city].filter(Boolean).join(" · ")}
          </p>
        </div>
        <SafetyMenu subjectUserId={p.userId} subjectName={p.name} />
      </div>

      {p.photos.length > 0 && (
        <PhotoCarousel photos={p.photos} alt={p.name} />
      )}

      {p.intent && (
        <p className="text-sm text-ink-soft">
          Looking for <span className="text-ink">{INTENT_LABELS[p.intent] ?? p.intent}</span>
        </p>
      )}

      {p.bio && (
        <p className="text-[0.95rem] leading-relaxed text-ink text-pretty">{p.bio}</p>
      )}

      {p.prompts.map((pr) => (
        <blockquote key={pr.id} className="border-l-2 border-glow-ring pl-3">
          <p className="text-xs text-ink-faint">{pr.question}</p>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink text-pretty">{pr.answer}</p>
        </blockquote>
      ))}

      {p.music && (
        <Section title="On repeat">
          <ChipList tone="moonlight" items={p.music.artists} />
          {p.music.mood && <p className="mt-1.5 text-sm italic text-ink-soft">“{p.music.mood}”</p>}
        </Section>
      )}

      {p.activity && (
        <Section title="How they move">
          <ChipList tone="glow" items={p.activity.activities} />
          {p.activity.lifestyle && (
            <p className="mt-1.5 text-sm italic text-ink-soft">“{p.activity.lifestyle}”</p>
          )}
        </Section>
      )}

      {p.interests.length > 0 && (
        <Section title="Into">
          <ChipList tone="neutral" items={p.interests} />
        </Section>
      )}

      {!p.music && !p.activity && !p.connected && (
        <p className="text-xs text-ink-faint">
          Some of {p.name}&apos;s profile is only visible once you&apos;re connected.
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">{title}</p>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function ChipList({
  items,
  tone,
}: {
  items: string[];
  tone: "glow" | "moonlight" | "neutral";
}) {
  const cls =
    tone === "moonlight"
      ? "bg-moonlight-soft text-moonlight"
      : tone === "glow"
        ? "bg-glow-soft text-glow-press"
        : "bg-sand text-ink-soft";
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs ${cls}`}>
          {i}
        </span>
      ))}
    </div>
  );
}
