import "server-only";
import { db } from "@/lib/db";
import { storage } from "@/lib/providers/storage";

export interface ConversationSummary {
  conversationId: string;
  matchId: string;
  other: { userId: string; name: string; photoUrl: string | null; verified: boolean };
  lastMessage: { body: string; at: Date; fromMe: boolean; system: boolean } | null;
  unread: number;
  matchedAt: Date;
  isNew: boolean; // matched, no human messages yet
}

export interface ThreadMessage {
  id: string;
  body: string;
  fromMe: boolean;
  system: boolean;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationThread {
  conversationId: string;
  matchId: string;
  other: {
    userId: string;
    name: string;
    age: number | null;
    photoUrl: string | null;
    verified: boolean;
    city: string | null;
  };
  messages: ThreadMessage[];
  closed: boolean;
  /** Why the two matched — highlight kinds + the single strongest thing. */
  matchedThrough: string[];
  matchHeadline: string | null;
}

function otherIdOf(match: { userAId: string; userBId: string }, me: string) {
  return match.userAId === me ? match.userBId : match.userAId;
}

export async function getConversations(userId: string): Promise<ConversationSummary[]> {
  const matches = await db.match.findMany({
    where: {
      closedAt: null,
      OR: [{ userAId: userId }, { userBId: userId }],
      conversation: { isNot: null },
    },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      createdAt: true,
      conversation: {
        select: {
          id: true,
          lastMessageAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, senderId: true, systemType: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const otherIds = matches.map((m) => otherIdOf(m, userId));
  const [profiles, unreadCounts] = await Promise.all([
    db.profile.findMany({
      where: { userId: { in: otherIds } },
      select: {
        userId: true,
        displayName: true,
        photos: {
          where: { isPrimary: true, moderationStatus: "APPROVED" },
          select: { storageKey: true },
          take: 1,
        },
        user: { select: { trust: { select: { photoVerified: true } } } },
      },
    }),
    db.message.groupBy({
      by: ["conversationId"],
      where: {
        conversation: { matchId: { in: matches.map((m) => m.id) } },
        senderId: { not: userId },
        readAt: null,
      },
      _count: { _all: true },
    }),
  ]);

  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const unreadByConvo = new Map(unreadCounts.map((u) => [u.conversationId, u._count._all]));

  return matches
    .map((m): ConversationSummary => {
      const otherId = otherIdOf(m, userId);
      const p = profileByUser.get(otherId);
      const last = m.conversation!.messages[0] ?? null;
      const humanLast = last && last.senderId !== null;
      return {
        conversationId: m.conversation!.id,
        matchId: m.id,
        other: {
          userId: otherId,
          name: p?.displayName ?? "Someone",
          photoUrl: p?.photos[0] ? storage.publicUrl(p.photos[0].storageKey) : null,
          verified: p?.user.trust?.photoVerified ?? false,
        },
        lastMessage: last
          ? {
              body: last.body,
              at: last.createdAt,
              fromMe: last.senderId === userId,
              system: last.senderId === null,
            }
          : null,
        unread: unreadByConvo.get(m.conversation!.id) ?? 0,
        matchedAt: m.createdAt,
        isNew: !humanLast,
      };
    })
    .sort(
      (a, b) =>
        (b.lastMessage?.at.getTime() ?? b.matchedAt.getTime()) -
        (a.lastMessage?.at.getTime() ?? a.matchedAt.getTime()),
    );
}

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationThread | null> {
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      match: {
        select: {
          id: true,
          userAId: true,
          userBId: true,
          closedAt: true,
          closedById: true,
          closeReason: true,
          contextHeadline: true,
          contextTags: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          body: true,
          senderId: true,
          systemType: true,
          createdAt: true,
          readAt: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!convo) return null;
  const { match } = convo;
  if (match.userAId !== userId && match.userBId !== userId) return null;
  // If this connection ended because one side blocked the other, the blocked
  // party loses read access too — they can't keep re-opening the thread.
  if (match.closeReason === "BLOCKED" && match.closedById !== userId) return null;

  const otherId = otherIdOf(match, userId);
  const other = await db.user.findUnique({
    where: { id: otherId },
    select: {
      birthdate: true,
      profile: {
        select: {
          displayName: true,
          city: true,
          photos: {
            where: { isPrimary: true, moderationStatus: "APPROVED" },
            select: { storageKey: true },
            take: 1,
          },
        },
      },
      trust: { select: { photoVerified: true } },
    },
  });

  const age = other?.birthdate
    ? new Date().getFullYear() - other.birthdate.getFullYear()
    : null;

  return {
    conversationId: convo.id,
    matchId: match.id,
    other: {
      userId: otherId,
      name: other?.profile?.displayName ?? "Someone",
      age,
      photoUrl: other?.profile?.photos[0]
        ? storage.publicUrl(other.profile.photos[0].storageKey)
        : null,
      verified: other?.trust?.photoVerified ?? false,
      city: other?.profile?.city ?? null,
    },
    messages: convo.messages
      .filter((m) => !m.deletedAt)
      .map((m) => ({
        id: m.id,
        body: m.body,
        fromMe: m.senderId === userId,
        system: m.senderId === null,
        createdAt: m.createdAt,
        readAt: m.readAt,
      })),
    closed: Boolean(match.closedAt),
    matchedThrough: match.contextTags,
    matchHeadline: match.contextHeadline,
  };
}

/** Mark the other participant's messages as read. Fire-and-forget from the thread page. */
export async function markConversationRead(userId: string, conversationId: string): Promise<void> {
  await db.message
    .updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
        conversation: {
          match: { OR: [{ userAId: userId }, { userBId: userId }] },
        },
      },
      data: { readAt: new Date() },
    })
    .catch(() => {});
}

export async function unreadConversationCount(userId: string): Promise<number> {
  const rows = await db.message.groupBy({
    by: ["conversationId"],
    where: {
      senderId: { not: userId },
      readAt: null,
      conversation: {
        match: {
          closedAt: null,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      },
    },
    _count: { _all: true },
  });
  return rows.length;
}
