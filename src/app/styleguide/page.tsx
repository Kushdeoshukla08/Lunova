"use client";

import * as React from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  Progress,
  RadioGroup,
  Select,
  Skeleton,
  Spinner,
  Textarea,
  VerifiedBadge,
} from "@/components/ui";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Wordmark } from "@/components/brand/wordmark";

export default function StyleGuide() {
  const [modal, setModal] = React.useState(false);
  const [chips, setChips] = React.useState<string[]>(["Coffee"]);
  const [intent, setIntent] = React.useState("long_term");

  const toggleChip = (c: string) =>
    setChips((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
      <div className="flex items-center justify-between">
        <Wordmark href={null} />
        <ThemeToggle />
      </div>
      <h1 className="mt-6 text-3xl font-display tracking-tight">Style guide</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Design-system reference. Dev-only — not linked in the product shell.
      </p>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="font-display text-5xl tracking-tight">Display / Fraunces</p>
          <p className="font-display text-2xl">Heading two</p>
          <p className="text-base text-ink-soft">
            Body / Inter — the quick brown fox jumps over the lazy dog.
          </p>
          <p className="text-xs uppercase tracking-wider text-ink-faint">
            Overline / meta
          </p>
        </div>
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["paper", "bg-paper"],
            ["paper-raised", "bg-paper-raised"],
            ["sand", "bg-sand"],
            ["sand-strong", "bg-sand-strong"],
            ["ink", "bg-ink"],
            ["glow", "bg-glow"],
            ["glow-soft", "bg-glow-soft"],
            ["moonlight", "bg-moonlight"],
            ["moonlight-soft", "bg-moonlight-soft"],
            ["ok", "bg-ok"],
            ["warn", "bg-warn"],
            ["danger", "bg-danger"],
          ].map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-[var(--radius-md)] border border-line">
              <div className={`h-14 ${cls}`} />
              <div className="bg-paper-raised px-2 py-1 text-xs text-ink-soft">{name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" hint="This is how you'll appear.">
            <Input placeholder="Maya" defaultValue="Maya" />
          </Field>
          <Field label="Email" error="That email is already in use." required>
            <Input type="email" defaultValue="maya@demo.lunova.local" />
          </Field>
          <Field label="City" className="sm:col-span-2">
            <Select defaultValue="lisbon">
              <option value="lisbon">Lisbon</option>
              <option value="berlin">Berlin</option>
              <option value="mexico-city">Mexico City</option>
            </Select>
          </Field>
          <Field label="A perfect Sunday looks like…" className="sm:col-span-2">
            <Textarea placeholder="Tide pools before the crowds…" />
          </Field>
        </div>
        <div className="mt-4 space-y-2">
          <Checkbox label="Show my music to matches only" defaultChecked />
          <Checkbox label="Pause discovery while I travel" />
        </div>
        <div className="mt-4">
          <RadioGroup
            name="intent"
            value={intent}
            onValueChange={setIntent}
            columns={2}
            options={[
              { value: "long_term", label: "Long-term", description: "Open to seeing where it goes" },
              { value: "short_term", label: "Short-term", description: "Something easygoing for now" },
              { value: "friends", label: "Friends", description: "New people, no pressure" },
              { value: "figuring", label: "Still figuring it out", description: "Honestly not sure yet" },
            ]}
          />
        </div>
      </Section>

      <Section title="Chips">
        <div className="flex flex-wrap gap-2">
          {["Coffee", "Hiking", "Film photography", "Yoga", "Vinyl", "Bouldering"].map((c) => (
            <Chip key={c} selected={chips.includes(c)} onSelectedChange={() => toggleChip(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Badges & avatars">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Long-term</Badge>
          <Badge tone="glow">🥾 You both hike</Badge>
          <Badge tone="moonlight">🎧 Music match</Badge>
          <Badge tone="ok">New here</Badge>
          <Badge tone="warn">Complete your profile</Badge>
          <VerifiedBadge />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Avatar name="Maya Alvares" size="sm" />
          <Avatar name="Arjun Rao" size="md" verified />
          <Avatar name="Sol" size="lg" />
        </div>
      </Section>

      <Section title="Cards & progress">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card interactive>
            <CardTitle>Interactive card</CardTitle>
            <p className="mt-1 text-sm text-ink-soft">Lifts a little on hover.</p>
          </Card>
          <Card>
            <CardTitle>Profile completeness</CardTitle>
            <Progress value={60} className="mt-3" label="Profile completeness" />
            <p className="mt-2 text-xs text-ink-faint">60% — add two more photos</p>
          </Card>
        </div>
      </Section>

      <Section title="Loading, empty & error">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <div className="flex items-center gap-2 text-ink-soft">
              <Spinner /> Loading…
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          </Card>
          <EmptyState
            title="No one new right now"
            description="Widen your distance or check back later — new people join every day."
            action={<Button size="sm" variant="secondary">Adjust filters</Button>}
          />
          <ErrorState action={<Button size="sm" variant="secondary">Retry</Button>} />
        </div>
      </Section>

      <Section title="Modal">
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Report this profile"
          description="Reports are private and go to our moderation team."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setModal(false)}>
                Submit report
              </Button>
            </>
          }
        >
          <RadioGroup
            name="report"
            options={[
              { value: "harassment", label: "Harassment" },
              { value: "fake", label: "Fake profile" },
              { value: "spam", label: "Spam" },
            ]}
          />
        </Modal>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-line pt-8">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-ink-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}
