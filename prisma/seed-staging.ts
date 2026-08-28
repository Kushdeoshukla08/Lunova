/**
 * Staging demo data. Diverse fictional personas so a first-time tester lands in
 * a populated, varied Discovery feed — not a wall of the same stereotypical
 * dating profile.
 *
 *   npm run db:seed:staging
 *
 * Refuses to run unless APP_ENV=staging AND SEED_STAGING=1. It is safe to re-run
 * (idempotent by email); pass SEED_STAGING_RESET=1 to wipe and rebuild.
 */
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createPersona, loadPersonaRefs } from "./personas";
import { DOMAIN, PERSONAS } from "./persona-data";

/**
 * The guard runs when seeding starts, not when this module is imported — the
 * Docker build imports PERSONAS to bake their photos into the image, and a
 * top-level `process.exit` would kill the build. Every path that touches the
 * database goes through `main()`, so it is no weaker for being in there.
 */
function assertSeedingAllowed(): void {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv !== "staging" || process.env.SEED_STAGING !== "1") {
    console.error(
      `Refusing to seed: needs APP_ENV=staging and SEED_STAGING=1 ` +
        `(got APP_ENV=${appEnv}, SEED_STAGING=${process.env.SEED_STAGING ?? "unset"}).`,
    );
    process.exit(1);
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });


async function connectPair(
  aId: string,
  bId: string,
  opts: { headline?: string; tags?: string[]; messages?: Array<[0 | 1, string]> } = {},
) {
  const [lo, hi] = [aId, bId].sort();
  const match = await prisma.match.create({
    data: {
      userAId: lo,
      userBId: hi,
      contextHeadline: opts.headline ?? null,
      contextTags: opts.tags ?? [],
      seenByA: true,
      seenByB: true,
    },
    select: { id: true },
  });
  const convo = await prisma.conversation.create({
    data: { matchId: match.id },
    select: { id: true },
  });
  const who = [lo, hi];
  let t = Date.now() - (opts.messages?.length ?? 0) * 3600_000;
  for (const [side, body] of opts.messages ?? []) {
    await prisma.message.create({
      data: { conversationId: convo.id, senderId: who[side], body, createdAt: new Date(t) },
    });
    t += 3600_000;
  }
  if (opts.messages?.length) {
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { lastMessageAt: new Date(t) },
    });
  }
}

async function main() {
  assertSeedingAllowed();
  const refCounts = await Promise.all([
    prisma.promptQuestion.count(),
    prisma.interest.count(),
    prisma.activityType.count(),
  ]);
  if (refCounts.some((c) => c === 0)) {
    console.error("Reference data missing — run `npm run db:seed` first.");
    process.exit(1);
  }

  if (process.env.SEED_STAGING_RESET === "1") {
    await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
    console.log(`• reset: removed existing ${DOMAIN} accounts`);
  }

  const { hashPassword } = await import("../src/lib/auth/password");
  const passwordHash = await hashPassword(
    process.env.SEED_STAGING_PASSWORD ?? "lunova-staging-demo",
  );
  const uploadRoot =
    process.cwd() + "/" + (process.env.STORAGE_LOCAL_DIR ?? ".uploads");
  const refs = await loadPersonaRefs(prisma);

  const ids: Record<string, string> = {};
  for (const [i, p] of PERSONAS.entries()) {
    const id = await createPersona(prisma, p, {
      passwordHash,
      uploadRoot,
      refs,
      lastActiveOffsetMs: i * 90 * 60 * 1000,
    });
    if (id) ids[p.name] = id;
  }

  // A few connections so populated states (and the north-star metric) aren't zero.
  if (ids.Priya && ids.Alex) {
    await connectPair(ids.Priya, ids.Alex, {
      headline: "a shared love of long walks and quiet records",
      tags: ["activity", "music", "distance"],
      messages: [
        [0, "Okay your run-when-a-song-demands-it line got me. Which song, most recently?"],
        [1, "Four Tet, 'Baby'. Sprinted a full block like an idiot. You?"],
        [0, "I don't run but I once speed-walked to 'Motion Sickness'. Counts."],
        [1, "Absolutely counts. Walk instead of run this weekend? I know a hill."],
        [0, "Sold. Saturday, before it gets hot?"],
        [1, "Perfect. I'll bring the bad coffee flask."],
      ],
    });
  }
  if (ids.Tomás && ids.Yuki) {
    await connectPair(ids.Tomás, ids.Yuki, {
      headline: "electronic music and a shared weakness for kitchen dance floors",
      tags: ["music", "interest"],
      messages: [
        [0, "A game designer who kitchen-dances. Tuesday class any good?"],
        [1, "I am genuinely terrible and it's the best hour of my week."],
        [0, "That's the correct amount of good. What are we cooking after, hypothetically."],
      ],
    });
  }
  if (ids.Jonas && ids.Sofia) {
    await connectPair(ids.Jonas, ids.Sofia, {
      headline: "you both plan your lives around water and early mornings",
      tags: ["activity", "intent"],
    });
  }

  const total = await prisma.user.count({
    where: { email: { endsWith: DOMAIN } },
  });
  console.log(
    `✓ staging personas: ${total} (${DOMAIN}) — password: SEED_STAGING_PASSWORD or "lunova-staging-demo"`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
