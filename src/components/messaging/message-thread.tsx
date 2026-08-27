"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { sendMessageAction } from "@/lib/messaging/actions";
import { markReadAction } from "@/lib/messaging/read-actions";
import { formatDayHeading, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/form-message";
import { useRealtime } from "@/components/realtime/realtime-provider";
import type { ThreadMessage } from "@/lib/conversations/service";

type PendingMsg = ThreadMessage & { tempId: string; state: "sending" | "sent" | "failed" };

export function MessageThread({
  conversationId,
  initialMessages,
  otherName,
  closed,
  matchHeadline,
}: {
  conversationId: string;
  initialMessages: ThreadMessage[];
  otherName: string;
  closed: boolean;
  matchHeadline?: string | null;
}) {
  const router = useRouter();
  const noHumanMessages = initialMessages.every((m) => m.system);
  // `initialMessages` (server truth) is the source for confirmed messages.
  // Local state holds only in-flight/failed sends, merged at render time.
  const [pending, setPending] = React.useState<PendingMsg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [sending, startSend] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);

  const confirmedIds = React.useMemo(
    () => new Set(initialMessages.map((m) => m.id)),
    [initialMessages],
  );
  const visiblePending = pending.filter(
    (p) => p.state !== "sent" || !confirmedIds.has(p.id),
  );
  const messages: (ThreadMessage & { tempId?: string; state?: PendingMsg["state"] })[] = [
    ...initialMessages,
    ...visiblePending,
  ];

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Live updates. Every event is a nudge — we re-fetch server truth rather than
  // splicing payloads in, so duplicates and out-of-order delivery are moot.
  useRealtime((event) => {
    if (event.type === "message" && event.conversationId === conversationId) {
      router.refresh();
      // we're looking at the thread, so mark it read straight away
      void markReadAction(conversationId);
    }
    if (event.type === "read" && event.conversationId === conversationId) {
      router.refresh();
    }
  });

  const send = () => {
    const body = draft.trim();
    if (!body || sending || closed) return;
    const tempId = `temp-${Date.now()}`;
    setPending((p) => [
      ...p,
      {
        id: tempId,
        tempId,
        body,
        fromMe: true,
        system: false,
        createdAt: new Date(),
        readAt: null,
        state: "sending",
      },
    ]);
    setDraft("");
    setError(undefined);
    startSend(async () => {
      const res = await sendMessageAction({ conversationId, body });
      if (!res.ok) {
        setError(res.error);
        setPending((p) =>
          p.map((x) => (x.tempId === tempId ? { ...x, state: "failed" } : x)),
        );
        return;
      }
      setPending((p) =>
        p.map((x) => (x.tempId === tempId ? { ...x, id: res.id, state: "sent" } : x)),
      );
      router.refresh();
    });
  };

  const groups = groupByDay(messages);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto py-4">
        {groups.map((g) => (
          <div key={g.day} className="flex flex-col gap-1.5">
            <div className="my-2 text-center text-xs text-ink-faint">{g.day}</div>
            {g.items.map((m) =>
              m.system ? (
                <p
                  key={m.id}
                  className="mx-auto my-1 max-w-[80%] rounded-full bg-sand px-3 py-1 text-center text-xs text-ink-soft"
                >
                  {m.body}
                </p>
              ) : (
                <div
                  key={m.tempId ?? m.id}
                  className={cn(
                    "flex motion-safe:animate-[orbit-in-sm_var(--dur)_var(--ease-orbit)]",
                    m.fromMe ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-[var(--radius-lg)] px-3.5 py-2 text-[0.95rem] leading-relaxed",
                      m.fromMe
                        ? "bg-glow text-white rounded-br-sm"
                        : "bg-sand text-ink rounded-bl-sm",
                      m.state === "failed" && "opacity-60 ring-1 ring-danger",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <span
                      className={cn(
                        "mt-0.5 flex items-center justify-end gap-1 text-[0.65rem]",
                        m.fromMe ? "text-white/70" : "text-ink-faint",
                      )}
                    >
                      {m.state === "sending"
                        ? "sending…"
                        : m.state === "failed"
                          ? "failed — tap Send to retry"
                          : formatTime(m.createdAt)}
                      {m.fromMe && !m.state && m.readAt && (
                        <span title="Read" aria-label="Message read" data-read-receipt>
                          <svg viewBox="0 0 16 12" className="h-2.5 w-4" aria-hidden="true">
                            <path
                              d="M1 6.5 4 9.5 9.5 2M6.5 8.5 8 10l5.5-8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        ))}

        {noHumanMessages && !closed && (
          <div className="mx-auto mt-4 max-w-xs rounded-[var(--radius-md)] bg-sand/60 px-4 py-3 text-center">
            <p className="editorial text-[0.95rem] leading-snug text-ink text-pretty">
              {matchHeadline
                ? `${matchHeadline}. That's your opening.`
                : "Open with something specific from their profile."}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              A real first line beats &ldquo;hey&rdquo; every time.
            </p>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {error && <FormMessage error={error} className="mb-2" />}

      {closed ? (
        <p className="border-t border-line py-4 text-center text-sm text-ink-faint">
          This conversation has ended.
        </p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={`Message ${otherName}`}
            aria-label={`Message ${otherName}`}
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-[var(--radius-lg)] border border-line-strong bg-paper-raised px-3.5 py-2.5 text-[0.95rem] focus:outline-none focus-visible:border-glow focus-visible:ring-4 focus-visible:ring-glow-ring/40"
          />
          <Button type="submit" loading={sending} disabled={!draft.trim()}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}

function groupByDay<T extends { id: string; createdAt: Date; tempId?: string }>(
  messages: T[],
) {
  const groups: { day: string; items: T[] }[] = [];
  for (const m of messages) {
    const day = formatDayHeading(m.createdAt);
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}
