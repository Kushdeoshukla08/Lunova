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
import { createPersona, loadPersonaRefs, type Persona } from "./personas";

const APP_ENV = process.env.APP_ENV ?? "development";
if (APP_ENV !== "staging" || process.env.SEED_STAGING !== "1") {
  console.error(
    `Refusing to seed: needs APP_ENV=staging and SEED_STAGING=1 ` +
      `(got APP_ENV=${APP_ENV}, SEED_STAGING=${process.env.SEED_STAGING ?? "unset"}).`,
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DOMAIN = "@people.lunova-staging.app"; // obviously fictional
type RGB = [number, number, number];
const grad = (a: RGB, b: RGB) => [a, b] as [RGB, RGB];

const PERSONAS: Persona[] = [
  // A — music-focused, runs occasionally, creative, wants something serious
  {
    email: `alex${DOMAIN}`,
    name: "Alex",
    gender: "NONBINARY",
    pronouns: "they/them",
    city: "Lisbon",
    country: "PT",
    lat: 38.722,
    lng: -9.139,
    age: 30,
    intent: "LONG_TERM",
    bio: "Records more than I listen back. I run when a song demands it. Building a small type foundry.",
    gradient: grad([236, 224, 246], [214, 178, 199]),
    prompts: [
      ["i-feel-most-like-myself-when", "Front row, terrible sound system, someone's first show."],
      ["currently-learning", "Modular synthesis. It's mostly patch cables and regret."],
    ],
    interests: ["live-music", "vinyl", "design", "writing", "running", "bookstores"],
    genres: ["Indie", "Electronic", "Jazz"],
    artists: ["Caroline Polachek", "Four Tet", "Alice Coltrane"],
    mood: "one long take that builds for nine minutes",
    activities: ["running"],
    lifestyle: "a run when the mood strikes, long studio nights",
    activeDaysPerWeek: 2,
  },
  // B — walker / yoga, not athletic, outdoor-oriented, meaningful connection
  {
    email: `priya${DOMAIN}`,
    name: "Priya",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.73,
    lng: -9.15,
    age: 34,
    intent: "LONG_TERM",
    bio: "Long walks are my whole personality. Yoga on the balcony. I know every miradouro worth the climb.",
    gradient: grad([246, 235, 216], [199, 214, 199]),
    prompts: [
      ["a-perfect-sunday", "A three-hour walk with no destination, ending wherever has good bread."],
      ["one-thing-i-d-love-someone-to-join-me-for", "Sunset from a hill I haven't tried yet."],
    ],
    interests: ["sunrise-walks", "yoga", "gardening", "tea", "poetry", "museums"],
    genres: ["Folk", "Ambient", "Soul"],
    artists: ["Nick Drake", "Cleo Sol", "Grouper"],
    mood: "something quiet with a lot of space in it",
    activities: ["walking", "yoga"],
    lifestyle: "a long walk most days, unhurried",
    activeDaysPerWeek: 5,
  },
  // C — cyclist, electronic music, social, open to meeting people
  {
    email: `tomas${DOMAIN}`,
    name: "Tomás",
    gender: "MAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.71,
    lng: -9.14,
    age: 28,
    intent: "SHORT_TERM_OPEN_LONG",
    bio: "Two wheels everywhere. I DJ friends' kitchens. Ask me where to eat and clear your evening.",
    gradient: grad([209, 226, 224], [178, 199, 214]),
    prompts: [
      ["where-you-ll-find-me-on-a-friday-night", "Someone's kitchen, slightly too loud, definitely dancing."],
      ["the-easiest-way-to-impress-me", "Take the long way because it's prettier."],
    ],
    interests: ["cycling", "live-music", "street-food", "cocktails", "travel", "board-games"],
    genres: ["House", "Electronic", "Disco"],
    artists: ["Fred again..", "Peggy Gou", "Jamie xx"],
    mood: "sunrise set energy, no lyrics needed",
    activities: ["cycling", "run-club", "group-classes"],
    lifestyle: "commuting by bike, weekend group rides",
    activeDaysPerWeek: 5,
  },
  // D — bookish / artistic, low activity, indie music, introverted
  {
    email: `mira${DOMAIN}`,
    name: "Mira",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.72,
    lng: -9.13,
    age: 32,
    intent: "FIGURING_IT_OUT",
    bio: "Illustrator. Happiest with a book and a window. I don't exercise, I wander to the bookshop.",
    gradient: grad([247, 220, 209], [214, 199, 178]),
    prompts: [
      ["i-ll-never-get-tired-of", "The first twenty pages of a novel that's going to be good."],
      ["my-love-language-in-practice", "Leaving the book I just finished on your side of the table."],
    ],
    interests: ["bookstores", "sketching", "poetry", "slow-mornings", "tea", "film-photography"],
    genres: ["Indie", "Folk", "Dream pop"],
    artists: ["Big Thief", "Sufjan Stevens", "Mazzy Star"],
    mood: "rain on the window, side one only",
    activities: [],
    lifestyle: "mostly still, the occasional long museum day",
    activeDaysPerWeek: 1,
  },
  // E — travel-oriented, mixed music, occasional hiking, social
  {
    email: `jonas${DOMAIN}`,
    name: "Jonas",
    gender: "MAN",
    city: "Porto",
    country: "PT",
    lat: 41.158,
    lng: -8.629,
    age: 37,
    intent: "LONG_TERM_OPEN_SHORT",
    bio: "Half my year is elsewhere. Hike when the trail's on the way. I collect regional playlists and cheap hotels with a view.",
    gradient: grad([224, 235, 246], [199, 199, 214]),
    prompts: [
      ["two-truths-and-a-hope", "Been to 40 countries; can't drive; hope the next trip is with someone."],
      ["one-thing-i-d-love-someone-to-join-me-for", "A night train, anywhere, no fixed return."],
    ],
    interests: ["travel", "hiking", "street-food", "history-podcasts", "museums", "natural-wine"],
    genres: ["World", "Jazz", "Indie"],
    artists: ["Khruangbin", "Bombino", "Altin Gün"],
    mood: "a playlist named after wherever I am this week",
    activities: ["hiking", "walking"],
    lifestyle: "a hike when travel allows, walking new cities for hours",
    activeDaysPerWeek: 3,
  },

  // more, for range
  {
    email: `sofia${DOMAIN}`,
    name: "Sofia",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.74,
    lng: -9.16,
    age: 41,
    intent: "LONG_TERM",
    bio: "Cardiologist, sea swimmer, single parent to a very opinionated eight-year-old. Time is short; I use it well.",
    gradient: grad([246, 224, 224], [214, 178, 178]),
    prompts: [
      ["a-cause-i-care-about", "Public healthcare that treats people like people."],
      ["where-you-ll-find-me-on-a-friday-night", "Asleep by ten, honestly, and unashamed."],
    ],
    interests: ["swimming", "home-cooking", "sea", "gardening", "history-podcasts", "coffee"],
    genres: ["Classical", "Bossa nova", "Soul"],
    artists: ["Ólafur Arnalds", "João Gilberto", "Nina Simone"],
    mood: "morning focus, strings, no words",
    activities: ["swimming", "walking"],
    lifestyle: "an early swim, everything else fits around the kid",
    activeDaysPerWeek: 4,
    pref: { minAge: 36, maxAge: 52, maxDistanceKm: 40 },
  },
  {
    email: `deniz${DOMAIN}`,
    name: "Deniz",
    gender: "NONBINARY",
    pronouns: "they/them",
    city: "Lisbon",
    country: "PT",
    lat: 38.715,
    lng: -9.145,
    age: 26,
    intent: "SHORT_TERM",
    bio: "Climbing gym five nights a week, tattoo apprentice the other two. Blunt, warm, allergic to small talk.",
    gradient: grad([214, 224, 199], [178, 199, 178]),
    prompts: [
      ["the-easiest-way-to-impress-me", "Try the hard route, fall off, laugh, try again."],
      ["my-most-irrational-obsession", "Chalk brands. I have opinions and they are correct."],
    ],
    interests: ["climbing", "sketching", "bouldering", "street-food", "live-music", "thrifting"],
    genres: ["Punk", "Hip-hop", "Electronic"],
    artists: ["IDLES", "Little Simz", "Overmono"],
    mood: "something loud to warm up, something slow to come down",
    activities: ["climbing", "gym", "calisthenics"],
    lifestyle: "at the wall most nights, strong and stubborn",
    activeDaysPerWeek: 6,
    pref: { minAge: 23, maxAge: 35 },
  },
  {
    email: `hannah${DOMAIN}`,
    name: "Hannah",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.725,
    lng: -9.155,
    age: 29,
    intent: "FRIENDS",
    bio: "New in town, here for the people not the dating. Board game nights, trivia teams, hiking buddies — all welcome.",
    gradient: grad([224, 246, 235], [178, 214, 199]),
    prompts: [
      ["one-thing-i-d-love-someone-to-join-me-for", "A pub quiz where we lose with dignity."],
      ["currently-learning", "Portuguese, badly, with great enthusiasm."],
    ],
    interests: ["board-games", "hiking", "stand-up-comedy", "baking", "language-learning", "coffee"],
    genres: ["Pop", "Indie", "Folk"],
    artists: ["Haim", "Lorde", "Maggie Rogers"],
    mood: "a road-trip singalong playlist",
    activities: ["hiking", "walk-and-talk", "group-classes"],
    lifestyle: "weekend hikes with whoever's free",
    activeDaysPerWeek: 3,
    pref: { minAge: 24, maxAge: 40 },
  },
  {
    email: `rui${DOMAIN}`,
    name: "Rui",
    gender: "MAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.705,
    lng: -9.17,
    age: 45,
    intent: "LONG_TERM",
    bio: "Carpenter. I fix things and I'm slow to speak. Jazz on Sunday, dog on the beach, no rush.",
    gradient: grad([235, 224, 214], [199, 178, 158]),
    prompts: [
      ["i-feel-most-like-myself-when", "Hands busy, radio low, the shape finally coming out of the wood."],
      ["my-love-language-in-practice", "I'll build you the shelf you keep mentioning."],
    ],
    interests: ["home-cooking", "dogs", "jazz", "gardening", "natural-wine", "sea"],
    genres: ["Jazz", "Blues", "Fado"],
    artists: ["Bill Evans", "Amália Rodrigues", "Chet Baker"],
    mood: "a worn record, Sunday-morning slow",
    activities: ["walking", "swimming"],
    lifestyle: "a beach walk with the dog, most mornings",
    activeDaysPerWeek: 4,
    pref: { minAge: 36, maxAge: 50 },
  },
  {
    email: `yuki${DOMAIN}`,
    name: "Yuki",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.718,
    lng: -9.128,
    age: 31,
    intent: "LONG_TERM_OPEN_SHORT",
    bio: "Game designer. Dance class on Tuesdays, terrible at it, love it anyway. Will out-cook you and out-argue you.",
    gradient: grad([246, 224, 240], [199, 178, 214]),
    prompts: [
      ["the-last-thing-that-made-me-laugh-out-loud", "My dance teacher, gently, about my sense of rhythm."],
      ["a-perfect-sunday", "Farmers market, long cook, friends who stay too late."],
    ],
    interests: ["home-cooking", "board-games", "live-music", "farmers-markets", "anime", "natural-wine"],
    genres: ["Pop", "R&B", "Hip-hop"],
    artists: ["Rina Sawayama", "SZA", "Yeule"],
    mood: "kitchen-dancing while the pasta water heats",
    activities: ["dance", "walking"],
    lifestyle: "a dance class I'm bad at, plenty of walking",
    activeDaysPerWeek: 3,
  },
  {
    email: `mateus${DOMAIN}`,
    name: "Mateus",
    gender: "MAN",
    city: "Porto",
    country: "PT",
    lat: 41.15,
    lng: -8.61,
    age: 27,
    intent: "FIGURING_IT_OUT",
    bio: "PhD in marine biology, which is a fancy way of saying I'm always slightly damp. Surf at dawn, tide charts on the fridge.",
    gradient: grad([199, 224, 235], [158, 189, 214]),
    prompts: [
      ["i-ll-never-get-tired-of", "The sea being completely indifferent to my week."],
      ["a-cause-i-care-about", "Coastal ecosystems, loudly, at parties, sorry."],
    ],
    interests: ["surfing", "swimming", "sea", "camping", "climate", "film-photography"],
    genres: ["Indie", "Surf rock", "Electronic"],
    artists: ["Tame Impala", "Allah-Las", "Bonobo"],
    mood: "salt-in-the-hair guitar, mid-tempo",
    activities: ["surfing", "swimming", "running"],
    lifestyle: "in the water at dawn, wetsuit always drying somewhere",
    activeDaysPerWeek: 5,
    pref: { minAge: 23, maxAge: 36 },
  },
  {
    email: `elena${DOMAIN}`,
    name: "Elena",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.735,
    lng: -9.142,
    age: 52,
    intent: "LONG_TERM",
    bio: "Retired teacher, full-time grandmother-in-training, part-time troublemaker. Tango on Thursdays. Not here to waste anyone's time.",
    gradient: grad([246, 240, 224], [214, 199, 168]),
    prompts: [
      ["two-truths-and-a-hope", "Raised three kids; still can't parallel park; hope to dance at 80."],
      ["where-you-ll-find-me-on-a-friday-night", "A milonga, in the good shoes, until my feet give out."],
    ],
    interests: ["theatre", "home-cooking", "poetry", "travel", "museums", "long-dinners"],
    genres: ["Tango", "Classical", "Fado"],
    artists: ["Astor Piazzolla", "Maria Callas", "Mariza"],
    mood: "something with a pulse you can't sit still to",
    activities: ["dance", "walking"],
    lifestyle: "tango nights, long walks, nothing hurried",
    activeDaysPerWeek: 3,
    pref: { minAge: 45, maxAge: 65 },
  },
  {
    email: `sam${DOMAIN}`,
    name: "Sam",
    gender: "MAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.712,
    lng: -9.135,
    age: 36,
    intent: "SHORT_TERM_OPEN_LONG",
    bio: "Remote dev, five-a-side on Wednesdays, chronic weekend-trip planner. Low drama, high snacks.",
    gradient: grad([224, 235, 224], [178, 209, 178]),
    prompts: [
      ["the-easiest-way-to-impress-me", "Have a spreadsheet for something that doesn't need one."],
      ["one-thing-i-d-love-someone-to-join-me-for", "A last-minute train somewhere with a castle."],
    ],
    interests: ["football", "travel", "board-games", "startups", "street-food", "cycling"],
    genres: ["Hip-hop", "Electronic", "Rock"],
    artists: ["Kaytranada", "Anderson .Paak", "Foals"],
    mood: "a Friday-afternoon, work's-done playlist",
    activities: ["football", "cycling", "run-club"],
    lifestyle: "five-a-side midweek, exploring on weekends",
    activeDaysPerWeek: 4,
  },
  {
    email: `noa${DOMAIN}`,
    name: "Noa",
    gender: "NONBINARY",
    pronouns: "they/them",
    city: "Lisbon",
    country: "PT",
    lat: 38.728,
    lng: -9.149,
    age: 24,
    intent: "FIGURING_IT_OUT",
    bio: "Music student, choir nerd, keeper of houseplants I cannot name. Gentle pace, big feelings.",
    gradient: grad([235, 224, 246], [189, 178, 214]),
    prompts: [
      ["i-feel-most-like-myself-when", "Mid-harmony, when the whole room locks into the chord."],
      ["my-most-irrational-obsession", "Field recordings of trains. I have a folder. It's large."],
    ],
    interests: ["live-music", "plants", "poetry", "tea", "bookstores", "sketching"],
    genres: ["Classical", "Choral", "Folk"],
    artists: ["Hildur Guðnadóttir", "Bon Iver", "Meredith Monk"],
    mood: "voices layered until it stops sounding like voices",
    activities: ["walking", "yoga"],
    lifestyle: "walks between rehearsals, a slow yoga habit",
    activeDaysPerWeek: 3,
    pref: { minAge: 21, maxAge: 32 },
  },
];

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
