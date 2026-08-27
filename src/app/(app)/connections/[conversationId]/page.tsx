import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/dal";
import { getConversation, markConversationRead } from "@/lib/conversations/service";
import { Avatar } from "@/components/ui/avatar";
import { SafetyMenu } from "@/components/safety/safety-menu";
import { MessageThread } from "@/components/messaging/message-thread";

export async function generateMetadata(
  props: PageProps<"/connections/[conversationId]">,
): Promise<Metadata> {
  const { conversationId } = await props.params;
  const user = await requireOnboardedUser();
  const convo = await getConversation(user.id, conversationId);
  return { title: convo ? `Chat with ${convo.other.name}` : "Conversation" };
}

export default async function ConversationPage(
  props: PageProps<"/connections/[conversationId]">,
) {
  const { conversationId } = await props.params;
  const user = await requireOnboardedUser();
  const convo = await getConversation(user.id, conversationId);
  if (!convo) notFound();

  // mark the other side's messages read on open (best-effort)
  await markConversationRead(user.id, conversationId);

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-6rem)]">
      <header className="flex items-center gap-3 border-b border-line pb-3">
        <Link
          href="/connections"
          aria-label="Back to connections"
          className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sand lg:hidden"
        >
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </Link>
        <Link href={`/u/${convo.other.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={convo.other.name} src={convo.other.photoUrl} size="sm" verified={convo.other.verified} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {convo.other.name}
              {convo.other.age ? `, ${convo.other.age}` : ""}
            </p>
            {convo.other.city && (
              <p className="truncate text-xs text-ink-faint">{convo.other.city}</p>
            )}
          </div>
        </Link>
        <SafetyMenu
          subjectUserId={convo.other.userId}
          subjectName={convo.other.name}
          matchId={convo.matchId}
          conversationId={convo.conversationId}
        />
      </header>

      {convo.matchedThrough.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line py-2.5 text-xs text-ink-faint">
          <span>Matched through</span>
          {convo.matchedThrough.slice(0, 3).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-ink-soft"
            >
              {MATCH_KIND_ICON[k] ?? "·"} {MATCH_KIND_WORD[k] ?? k}
            </span>
          ))}
        </div>
      )}

      <MessageThread
        conversationId={convo.conversationId}
        initialMessages={convo.messages}
        otherName={convo.other.name}
        closed={convo.closed}
        matchHeadline={convo.matchHeadline}
      />
    </div>
  );
}

const MATCH_KIND_WORD: Record<string, string> = {
  music: "music",
  activity: "movement",
  interest: "interests",
  intent: "intent",
  distance: "nearby",
  prompt: "how you think",
};
const MATCH_KIND_ICON: Record<string, string> = {
  music: "🎵",
  activity: "🏃",
  interest: "✦",
  intent: "🎯",
  distance: "📍",
  prompt: "💬",
};
