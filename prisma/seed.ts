/**
 * Seed script — reference data only by default.
 *
 *   npm run db:seed            → prompt questions, interests, activity types (safe, idempotent)
 *   SEED_DEMO=1 npm run db:seed → also creates clearly-labelled demo accounts for local UI work
 *
 * Demo accounts are DEV-ONLY. They use the address domain @demo.lunova.local and
 * a shared throwaway password. They are never created when NODE_ENV=production.
 */
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PROMPT_QUESTIONS = [
  "A perfect Sunday looks like…",
  "I'll never get tired of…",
  "My most irrational obsession is…",
  "The easiest way to impress me is…",
  "Currently learning…",
  "One thing I'd love someone to join me for…",
  "The last thing that made me laugh out loud…",
  "I feel most like myself when…",
  "A cause I care about…",
  "Two truths and a hope…",
  "My love language, in practice…",
  "Where you'll find me on a Friday night…",
];

const INTERESTS: Array<[string, string]> = [
  // slug/label pairs grouped by category
  ...group("Creative", [
    "Film photography",
    "Live music",
    "Pottery",
    "Writing",
    "Sketching",
    "Vinyl",
    "Film buff",
    "Design",
  ]),
  ...group("Outdoors", [
    "Hiking",
    "Camping",
    "Bouldering",
    "Kayaking",
    "Birdwatching",
    "Gardening",
    "Surfing",
    "Sunrise walks",
  ]),
  ...group("Food & drink", [
    "Coffee",
    "Home cooking",
    "Baking",
    "Natural wine",
    "Street food",
    "Farmers markets",
    "Tea",
    "Cocktails",
  ]),
  ...group("Mind & body", [
    "Yoga",
    "Meditation",
    "Running",
    "Pilates",
    "Climbing",
    "Cycling",
    "Swimming",
    "Martial arts",
  ]),
  ...group("Ideas", [
    "Philosophy",
    "Astronomy",
    "History podcasts",
    "Language learning",
    "Chess",
    "Startups",
    "Climate",
    "Psychology",
  ]),
  ...group("Culture", [
    "Museums",
    "Theatre",
    "Bookstores",
    "Poetry",
    "Stand-up comedy",
    "Board games",
    "Anime",
    "Travel",
  ]),
  ...group("Home life", [
    "Plants",
    "Cats",
    "Dogs",
    "Slow mornings",
    "Thrifting",
    "Baking bread",
    "Puzzles",
    "Long dinners",
  ]),
];

const ACTIVITY_TYPES: Array<[string, string, string]> = [
  // slug, label, category
  ["running", "Running", "endurance"],
  ["walking", "Walking", "endurance"],
  ["cycling", "Cycling", "endurance"],
  ["swimming", "Swimming", "endurance"],
  ["rowing", "Rowing", "endurance"],
  ["gym", "Gym & strength", "strength"],
  ["climbing", "Climbing", "strength"],
  ["calisthenics", "Calisthenics", "strength"],
  ["hiking", "Hiking", "outdoor"],
  ["trail-running", "Trail running", "outdoor"],
  ["surfing", "Surfing", "outdoor"],
  ["skiing", "Skiing & snowboarding", "outdoor"],
  ["skating", "Skating", "outdoor"],
  ["yoga", "Yoga", "mind-body"],
  ["pilates", "Pilates", "mind-body"],
  ["martial-arts", "Martial arts", "mind-body"],
  ["dance", "Dance", "mind-body"],
  ["football", "Football", "team"],
  ["basketball", "Basketball", "team"],
  ["tennis", "Tennis & racket sports", "team"],
  ["volleyball", "Volleyball", "team"],
  ["run-club", "Run clubs", "social"],
  ["group-classes", "Group classes", "social"],
  ["walk-and-talk", "Walk & talk", "social"],
];

function group(category: string, labels: string[]): Array<[string, string]> {
  return labels.map((label) => [`${slugify(category)}--${slugify(label)}`, label] as [string, string]).map(
    ([slug, label]) => [slug, `${category}::${label}`] as [string, string],
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seedReferenceData() {
  // Prompt questions
  for (let i = 0; i < PROMPT_QUESTIONS.length; i++) {
    const text = PROMPT_QUESTIONS[i];
    const slug = slugify(text).slice(0, 60);
    await prisma.promptQuestion.upsert({
      where: { slug },
      update: { text, position: i, active: true },
      create: { slug, text, position: i },
    });
  }

  // Interests
  for (const [slug, packed] of INTERESTS) {
    const [category, label] = packed.split("::");
    await prisma.interest.upsert({
      where: { slug },
      update: { label, category },
      create: { slug, label, category },
    });
  }

  // Activity types
  for (const [slug, label, category] of ACTIVITY_TYPES) {
    await prisma.activityType.upsert({
      where: { slug },
      update: { label, category },
      create: { slug, label, category },
    });
  }

  const [pq, ints, acts] = await Promise.all([
    prisma.promptQuestion.count(),
    prisma.interest.count(),
    prisma.activityType.count(),
  ]);
  console.log(`✓ reference data: ${pq} prompts, ${ints} interests, ${acts} activity types`);
}

async function seedDemoAccounts() {
  if (process.env.NODE_ENV === "production") {
    console.log("• SEED_DEMO ignored in production");
    return;
  }
  const { hashPassword } = await import("../src/lib/auth/password");
  const passwordHash = await hashPassword("lunova-demo-pass");

  const demos = [
    { email: "maya@demo.lunova.local", name: "Maya", gender: "WOMAN" as const, city: "Lisbon", country: "PT" },
    { email: "arjun@demo.lunova.local", name: "Arjun", gender: "MAN" as const, city: "Berlin", country: "DE" },
    { email: "sol@demo.lunova.local", name: "Sol", gender: "NONBINARY" as const, city: "Mexico City", country: "MX" },
  ];

  for (const d of demos) {
    const birthdate = new Date(1996, 3, 12);
    await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        passwordHash,
        birthdate,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
        ageVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: d.name,
            gender: d.gender,
            city: d.city,
            country: d.country,
            locationPrecision: "CITY",
            bio: `Demo profile for local development (${d.name}).`,
            completeness: 40,
          },
        },
        preference: { create: {} },
        privacy: { create: {} },
        trust: { create: { emailVerified: true } },
        notificationPref: { create: {} },
      },
    });
  }
  console.log(`✓ demo accounts: ${demos.length} (password: "lunova-demo-pass")`);
}

async function main() {
  await seedReferenceData();
  if (process.env.SEED_DEMO === "1") {
    await seedDemoAccounts();
  }
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
