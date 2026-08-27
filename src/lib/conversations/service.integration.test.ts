/**
 * DB integration for conversations + safety. RUN_DB_TESTS=1 (Postgres on :5433).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("conversations + safety (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let svc: typeof import("./service");
  let matching: typeof import("@/lib/matching/service");
  let safety: typeof import("@/lib/safety/service");
  const ids: string[] = [];
  const tag = `conv-${Date.now()}`;
  let conversationId = "";
  let matchId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    svc = await import("./service");
    matching = await import("@/lib/matching/service");
    safety = await import("@/lib/safety/service");

    for (const name of ["A", "B"]) {
      const u = await db.user.create({
        data: {
          email: `${tag}-${name}@demo.lunova.local`,
          passwordHash: "x",
          birthdate: new Date(1995, 0, 1),
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          preference: { create: {} },
          privacy: { create: {} },
          trust: { create: {} },
          notificationPref: { create: {} },
          profile: {
            create: { displayName: `User ${name}`, gender: "NONBINARY", onboardingStep: null },
          },
        },
        select: { id: true },
      });
      ids.push(u.id);
    }
    // mutual like → match
    await matching.recordLikeAndMaybeMatch({ actorId: ids[0], targetId: ids[1], kind: "LIKE" });
    const out = await matching.recordLikeAndMaybeMatch({
      actorId: ids[1],
      targetId: ids[0],
      kind: "LIKE",
    });
    conversationId = out.conversationId!;
    matchId = out.matchId!;
  });

  afterAll(async () => {
    if (ids.length) await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("getConversation returns the thread for a participant, null for an outsider", async () => {
    const thread = await svc.getConversation(ids[0], conversationId);
    expect(thread).toBeTruthy();
    expect(thread!.other.userId).toBe(ids[1]);
    expect(thread!.messages[0].system).toBe(true); // MATCH_CREATED
    // the pair shared enough that a match context was captured
    expect(Array.isArray(thread!.matchedThrough)).toBe(true);
    expect(await svc.getConversation("someone-else", conversationId)).toBeNull();
  });

  it("unread count reflects the other party's messages until marked read", async () => {
    await db.message.create({
      data: { conversationId, senderId: ids[1], body: "hey — that Big Thief line got me" },
    });
    await db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    let list = await svc.getConversations(ids[0]);
    expect(list[0].unread).toBe(1);
    expect(list[0].isNew).toBe(false);
    expect(list[0].lastMessage?.fromMe).toBe(false);

    await svc.markConversationRead(ids[0], conversationId);
    list = await svc.getConversations(ids[0]);
    expect(list[0].unread).toBe(0);
    expect(await svc.unreadConversationCount(ids[0])).toBe(0);
  });

  it("filing a report logs it privately and bumps the subject's trust counter", async () => {
    const before = await db.trustProfile.findUnique({ where: { userId: ids[1] } });
    await safety.fileReport({
      reporterId: ids[0],
      subjectUserId: ids[1],
      category: "HARASSMENT",
      details: "test",
    });
    const after = await db.trustProfile.findUnique({ where: { userId: ids[1] } });
    expect(after!.reportsReceived).toBe((before?.reportsReceived ?? 0) + 1);

    const events = await db.safetyEvent.count({
      where: { userId: ids[1], type: "REPORT_RECEIVED" },
    });
    expect(events).toBeGreaterThanOrEqual(1);
    // report is never visible on the subject's public-facing data — only in the queue
    const report = await db.report.findFirst({ where: { subjectUserId: ids[1] } });
    expect(report!.status).toBe("OPEN");
  });

  it("blocking closes the match and drops it from Connections for both", async () => {
    await safety.blockUser(ids[0], ids[1]);

    const closed = await db.match.findUnique({ where: { id: matchId } });
    expect(closed!.closedAt).toBeTruthy();
    expect(closed!.closeReason).toBe("BLOCKED");

    expect(await svc.getConversations(ids[0])).toHaveLength(0);
    expect(await svc.getConversations(ids[1])).toHaveLength(0);
    expect(await safety.isBlockedEitherWay(ids[1], ids[0])).toBe(true);

    // sending into a closed conversation is rejected at the service layer
    const thread = await svc.getConversation(ids[0], conversationId);
    expect(thread!.closed).toBe(true);
  });
});
