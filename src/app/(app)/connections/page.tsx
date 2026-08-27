import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getConversations } from "@/lib/conversations/service";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { LiveRefresh } from "@/components/realtime/live-refresh";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const user = await requireOnboardedUser();
  const conversations = await getConversations(user.id);

  return (
    <div className="flex flex-col gap-5">
      <LiveRefresh on={["message", "match", "read"]} />
      <div>
        <h1 className="text-2xl font-display tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-ink-soft">
          People you both said yes to. Start with something specific.
        </p>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          title="No connections yet"
          description="When you and someone both like each other, they'll show up here with a reason to talk."
          action={
            <Link href="/discover" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Go to Discover
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-paper-raised">
          {conversations.map((c) => (
            <li key={c.conversationId}>
              <Link
                href={`/connections/${c.conversationId}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-sand/50"
              >
                <Avatar name={c.other.name} src={c.other.photoUrl} size="md" verified={c.other.verified} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink">{c.other.name}</span>
                    {c.isNew && <Badge tone="glow">New match</Badge>}
                  </div>
                  <p className="truncate text-sm text-ink-soft">
                    {c.lastMessage
                      ? c.lastMessage.system
                        ? c.lastMessage.body
                        : `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}`
                      : "Say hi with something from their profile"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-ink-faint">
                    {formatRelative(c.lastMessage?.at ?? c.matchedAt)}
                  </span>
                  {c.unread > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-glow px-1.5 text-xs font-medium text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
