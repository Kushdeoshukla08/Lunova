/**
 * DEV helper — sends a message AS the other participant, so you can watch the
 * live update land in a browser tab without a second browser session.
 *
 *   tsx scripts/realtime-poke.ts <conversationId> "message body"
 *
 * Writes straight to the DB, then hits the running dev server's internal poke
 * endpoint so the in-process realtime provider (which lives in the server, not
 * this script) fans the event out.
 */
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [conversationId, body] = process.argv.slice(2);
if (!conversationId || !body) {
  console.error('usage: tsx scripts/realtime-poke.ts <conversationId> "message"');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const APP = process.env.APP_URL ?? "http://localhost:3006";

async function main() {
  const convo = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { match: { select: { userAId: true, userBId: true } } },
  });

  // Send as userA (the "other" side for whoever is browsing as userB, and vice
  // versa — pass the id you want via LUNOVA_POKE_AS to be explicit).
  const senderId = process.env.LUNOVA_POKE_AS ?? convo.match.userAId;
  const recipientId =
    senderId === convo.match.userAId ? convo.match.userBId : convo.match.userAId;

  const message = await db.message.create({
    data: { conversationId, senderId, body },
    select: { id: true, createdAt: true },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  const res = await fetch(`${APP}/api/dev/realtime-poke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: recipientId,
      event: {
        type: "message",
        conversationId,
        messageId: message.id,
        senderId,
        body,
        createdAt: message.createdAt.toISOString(),
      },
    }),
  });

  console.log(
    `message ${message.id} from ${senderId} → ${recipientId}; poke: ${res.status}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
