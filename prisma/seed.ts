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

type Demo = {
  email: string;
  name: string;
  gender: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  age: number;
  intent: string;
  bio: string;
  gradient: [[number, number, number], [number, number, number]];
  prompts: Array<[string, string]>; // [question-slug-fragment, answer]
  interests: string[]; // interest slugs (partial-match ok)
  genres: string[];
  artists: string[];
  mood: string;
  activities: string[]; // activityType slugs
  lifestyle: string;
};

const DEMOS: Demo[] = [
  {
    email: "maya@demo.lunova.local",
    name: "Maya",
    gender: "WOMAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.7223,
    lng: -9.1393,
    age: 29,
    intent: "LONG_TERM",
    bio: "Slow mornings, tide pools before the crowds, and I will talk your ear off about film photography.",
    gradient: [[247, 220, 209], [214, 178, 199]],
    prompts: [
      ["a-perfect-sunday", "Tide pools before the crowds, then bread and nothing planned."],
      ["one-thing-i-d-love-someone-to-join-me-for", "A very slow bike ride with too many café stops."],
    ],
    interests: ["film-photography", "coffee", "hiking", "vinyl", "bookstores", "sunrise-walks"],
    genres: ["Indie", "Folk"],
    artists: ["Big Thief", "Phoebe Bridgers", "Caroline Polachek"],
    mood: "late-night trains and one very specific sad playlist",
    activities: ["hiking", "cycling", "yoga"],
    lifestyle: "long walks daily, a hike most weekends",
  },
  {
    email: "arjun@demo.lunova.local",
    name: "Arjun",
    gender: "MAN",
    city: "Lisbon",
    country: "PT",
    lat: 38.7,
    lng: -9.16,
    age: 31,
    intent: "LONG_TERM_OPEN_SHORT",
    bio: "Run club on weeknights, climbing on weekends, terrible at rest days. Learning to make proper dal.",
    gradient: [[209, 226, 224], [178, 199, 214]],
    prompts: [
      ["currently-learning", "How to slow down. Going badly, thanks for asking."],
      ["the-easiest-way-to-impress-me", "Have a strong opinion about a small thing."],
    ],
    interests: ["climbing", "coffee", "running", "startups", "street-food", "board-games"],
    genres: ["Electronic", "House", "Indie"],
    artists: ["Fred again..", "Big Thief", "Bonobo"],
    mood: "gym energy into a long cooldown",
    activities: ["running", "climbing", "cycling", "gym"],
    lifestyle: "weeknight run club, weekend climbing",
  },
  {
    email: "sol@demo.lunova.local",
    name: "Sol",
    gender: "NONBINARY",
    city: "Lisbon",
    country: "PT",
    lat: 38.74,
    lng: -9.13,
    age: 27,
    intent: "FIGURING_IT_OUT",
    bio: "Pottery studio regular, plant hoarder, and the friend who always knows the natural wine bar.",
    gradient: [[230, 224, 246], [199, 214, 199]],
    prompts: [
      ["my-most-irrational-obsession", "The exact temperature a flat white should be. It's a narrow window."],
      ["a-perfect-sunday", "Studio in the morning, farmers market, friends over for a long dinner."],
    ],
    interests: ["pottery", "natural-wine", "plants", "farmers-markets", "vinyl", "long-dinners"],
    genres: ["Soul", "Jazz", "Indie"],
    artists: ["Caroline Polachek", "Hiatus Kaiyote", "Sault"],
    mood: "kitchen dancing while the pasta water heats",
    activities: ["yoga", "walking", "dance"],
    lifestyle: "slow weekends, long walks, the occasional yoga class",
  },
  {
    email: "noor@demo.lunova.local",
    name: "Noor",
    gender: "WOMAN",
    city: "Porto",
    country: "PT",
    lat: 41.1579,
    lng: -8.6291,
    age: 33,
    intent: "LONG_TERM",
    bio: "Architect, sea swimmer year-round, keeps a running list of the best cheap eats in every city.",
    gradient: [[246, 235, 216], [214, 199, 178]],
    prompts: [
      ["i-ll-never-get-tired-of", "The first cold-water gasp when you get in. Every single time."],
      ["one-thing-i-d-love-someone-to-join-me-for", "A 7am swim followed by an enormous breakfast."],
    ],
    interests: ["swimming", "design", "travel", "street-food", "museums", "coffee"],
    genres: ["Classical", "Ambient", "Folk"],
    artists: ["Nils Frahm", "Big Thief", "Ólafur Arnalds"],
    mood: "morning focus playlists, no words",
    activities: ["swimming", "cycling", "hiking"],
    lifestyle: "a swim most mornings, cycling everywhere",
  },
];

async function seedDemoAccounts() {
  if (process.env.NODE_ENV === "production") {
    console.log("• SEED_DEMO ignored in production");
    return;
  }
  const { hashPassword } = await import("../src/lib/auth/password");
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { join, dirname } = await import("node:path");
  const { gradientPng } = await import("./demo-photo");
  const passwordHash = await hashPassword("lunova-demo-pass");

  if (process.env.SEED_DEMO_RESET === "1") {
    await prisma.user.deleteMany({
      where: { email: { endsWith: "@demo.lunova.local" } },
    });
    console.log("• reset: removed existing @demo.lunova.local accounts");
  }

  const uploadRoot = join(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? ".uploads");
  const [allQuestions, allInterests, allActivities] = await Promise.all([
    prisma.promptQuestion.findMany(),
    prisma.interest.findMany(),
    prisma.activityType.findMany(),
  ]);

  const findQuestion = (frag: string) =>
    allQuestions.find((q) => q.slug.includes(frag)) ?? allQuestions[0];
  const findInterest = (frag: string) =>
    allInterests.find((i) => i.slug.includes(frag) || i.label.toLowerCase().includes(frag));
  const findActivity = (slug: string) => allActivities.find((a) => a.slug === slug);

  for (const [n, d] of DEMOS.entries()) {
    if (
      await prisma.user.findUnique({ where: { email: d.email }, select: { id: true } })
    ) {
      continue;
    }
    const birthdate = new Date(new Date().getFullYear() - d.age, 5, 15);

    const user = await prisma.user.create({
      data: {
        email: d.email,
        passwordHash,
        birthdate,
        emailVerifiedAt: new Date(),
        ageVerifiedAt: new Date(),
        status: "ACTIVE",
        lastActiveAt: new Date(Date.now() - n * 3600_000),
        profile: {
          create: {
            displayName: d.name,
            gender: d.gender as never,
            pronouns: d.gender === "NONBINARY" ? "they/them" : undefined,
            city: d.city,
            country: d.country,
            latitude: d.lat,
            longitude: d.lng,
            locationPrecision: "CITY",
            relationshipIntent: d.intent as never,
            bio: d.bio,
            onboardingStep: null,
            completeness: 90,
          },
        },
        preference: {
          create: { minAge: 25, maxAge: 42, maxDistanceKm: 120, genders: [], globalMode: false },
        },
        privacy: { create: {} },
        trust: { create: { emailVerified: true, phoneVerified: true, photoVerified: true } },
        notificationPref: { create: {} },
      },
      select: { id: true, profile: { select: { id: true } } },
    });
    const profileId = user.profile!.id;

    // photos (2 generated gradients)
    for (let i = 0; i < 2; i++) {
      const key = `photos/demo/${d.name.toLowerCase()}-${i}.png`;
      const abs = join(uploadRoot, key);
      await mkdir(dirname(abs), { recursive: true });
      const [top, bottom] = i === 0 ? d.gradient : [d.gradient[1], d.gradient[0]];
      await writeFile(abs, gradientPng(600, 750, top, bottom));
      await prisma.photo.create({
        data: {
          profileId,
          storageKey: key,
          position: i,
          isPrimary: i === 0,
          width: 600,
          height: 750,
          moderationStatus: "APPROVED",
        },
      });
    }

    // prompts
    for (const [frag, answer] of d.prompts) {
      const q = findQuestion(frag);
      await prisma.profilePrompt.upsert({
        where: { profileId_questionId: { profileId, questionId: q.id } },
        update: { answer },
        create: { profileId, questionId: q.id, answer },
      });
    }

    // interests
    const interestIds = d.interests
      .map((frag) => findInterest(frag)?.id)
      .filter((x): x is string => Boolean(x));
    await prisma.profileInterest.createMany({
      data: interestIds.map((interestId) => ({ profileId, interestId })),
      skipDuplicates: true,
    });

    // music
    const music = await prisma.musicProfile.create({
      data: {
        profileId,
        provider: "internal",
        listeningMood: d.mood,
        topGenres: d.genres,
        visibility: "PUBLIC",
      },
    });
    for (const [rank, name] of d.artists.entries()) {
      const artist = await prisma.musicArtist.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      await prisma.musicProfileArtist.create({
        data: { musicProfileId: music.id, artistId: artist.id, rank },
      });
    }

    // activity
    const activity = await prisma.activityProfile.create({
      data: {
        profileId,
        preferredLifestyle: d.lifestyle,
        activeDaysPerWeek: 4,
        visibility: "PUBLIC",
      },
    });
    const activityIds = d.activities
      .map((s) => findActivity(s)?.id)
      .filter((x): x is string => Boolean(x));
    await prisma.activityProfileType.createMany({
      data: activityIds.map((activityTypeId) => ({
        activityProfileId: activity.id,
        activityTypeId,
      })),
      skipDuplicates: true,
    });
  }

  const count = await prisma.user.count({
    where: { email: { endsWith: "@demo.lunova.local" } },
  });
  console.log(
    `✓ demo accounts: ${count} fully-onboarded profiles (password: "lunova-demo-pass")`,
  );
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
