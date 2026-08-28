/**
 * READ-ONLY Discovery diagnostic.
 *
 * Answers: "why does this account get zero candidates?" by walking the exact
 * filter chain in `getDiscoveryFeed` in order, and reporting how many
 * candidates each stage removes and why. Uses the REAL compatibility engine
 * (`meetsPreferences` / `computeCompatibility`) for the decisive checks — it
 * does not re-implement matching.
 *
 * Writes NOTHING. Prints no secrets.
 *
 *   DATABASE_URL='<neon pooled url>' npx tsx scripts/diagnose-discovery.ts you@example.com
 */
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  computeCompatibility,
  meetsPreferences,
} from "../src/lib/compatibility/engine";
import { ageFromBirthdate } from "../src/lib/compatibility/geo";
import type { CompatInput } from "../src/lib/compatibility/types";

const email = process.argv[2];
if (!email) {
  console.error("usage: npx tsx scripts/diagnose-discovery.ts <your-account-email>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Host + database only — never the credentials. */
function safeTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

const sel = {
  id: true,
  createdAt: true,
  birthdate: true,
  status: true,
  profile: {
    select: {
      displayName: true,
      gender: true,
      city: true,
      latitude: true,
      longitude: true,
      onboardingStep: true,
      relationshipIntent: true,
      interests: { select: { interest: { select: { slug: true, label: true } } } },
      prompts: { select: { question: { select: { slug: true } } } },
      photos: {
        where: { moderationStatus: "APPROVED" as const },
        select: { id: true },
      },
      music: {
        select: {
          topGenres: true,
          artists: { select: { artist: { select: { name: true } } } },
        },
      },
      activity: {
        select: {
          preferredLifestyle: true,
          types: { select: { activityType: { select: { slug: true } } } },
        },
      },
    },
  },
  privacy: {
    select: {
      profileVisibility: true,
      discoveryPaused: true,
      incognito: true,
    },
  },
  preference: {
    select: {
      minAge: true,
      maxAge: true,
      maxDistanceKm: true,
      genders: true,
      globalMode: true,
    },
  },
} as const;

type Row = NonNullable<Awaited<ReturnType<typeof db.user.findFirst<{ select: typeof sel }>>>>;

function toCompat(u: Row): CompatInput {
  const p = u.profile!;
  return {
    userId: u.id,
    birthdate: u.birthdate,
    gender: p.gender,
    relationshipIntent: p.relationshipIntent,
    latitude: p.latitude,
    longitude: p.longitude,
    interests: p.interests.map((i) => i.interest.slug),
    interestLabels: Object.fromEntries(
      p.interests.map((i) => [i.interest.slug, i.interest.label]),
    ),
    music: p.music
      ? {
          artists: p.music.artists.map((a) => a.artist.name.toLowerCase()),
          genres: p.music.topGenres.map((g) => g.toLowerCase()),
        }
      : null,
    activity: p.activity
      ? {
          types: p.activity.types.map((t) => t.activityType.slug),
          lifestyle: p.activity.preferredLifestyle,
        }
      : null,
    answeredPrompts: p.prompts.map((q) => q.question.slug),
    preference: u.preference ?? {
      minAge: 18,
      maxAge: 100,
      maxDistanceKm: 500,
      genders: [],
      globalMode: true,
    },
  };
}

const h = (s: string) => `\n${"─".repeat(72)}\n${s}\n${"─".repeat(72)}`;

async function main() {
  console.log(h("B. DATABASE / ENVIRONMENT"));
  console.log(`  target        : ${safeTarget(process.env.DATABASE_URL!)}`);
  console.log(`  APP_ENV       : ${process.env.APP_ENV ?? "(unset)"}`);

  const totals = {
    users: await db.user.count(),
    personas: await db.user.count({
      where: { email: { endsWith: "@people.lunova-staging.app" } },
    }),
    demo: await db.user.count({ where: { email: { endsWith: "@demo.lunova.local" } } }),
  };
  console.log(`  users total   : ${totals.users}`);
  console.log(`  staging personas (@people.lunova-staging.app): ${totals.personas}`);
  console.log(`  local demo accounts (@demo.lunova.local)     : ${totals.demo}`);

  // ── viewer ────────────────────────────────────────────────────────────────
  const viewer = await db.user.findFirst({ where: { email }, select: sel });
  if (!viewer) {
    console.log(h("C. YOUR ACCOUNT"));
    console.log(`  ✗ No user with email ${email} in THIS database.`);
    console.log("    → the app you tested is pointed at a different database.");
    return;
  }

  console.log(h("C. YOUR SAVED PREFERENCES + ACCOUNT STATE"));
  const vp = viewer.profile;
  const vpref = viewer.preference;
  console.log(`  userId            : ${viewer.id}`);
  console.log(`  account status    : ${viewer.status}`);
  console.log(`  age               : ${ageFromBirthdate(viewer.birthdate)}`);
  console.log(`  gender            : ${vp?.gender ?? "(no profile)"}`);
  console.log(`  city / coords     : ${vp?.city ?? "—"} / ${vp?.latitude ?? "null"},${vp?.longitude ?? "null"}`);
  console.log(`  onboardingStep    : ${vp?.onboardingStep ?? "null (complete)"}`);
  console.log(`  approved photos   : ${vp?.photos.length ?? 0}`);
  console.log(`  profileVisibility : ${viewer.privacy?.profileVisibility}`);
  console.log(`  discoveryPaused   : ${viewer.privacy?.discoveryPaused}`);
  console.log(`  incognito         : ${viewer.privacy?.incognito}`);
  console.log(`  --- preferences ---`);
  console.log(`  minAge            : ${vpref?.minAge}`);
  console.log(`  maxAge            : ${vpref?.maxAge}`);
  console.log(`  maxDistanceKm     : ${vpref?.maxDistanceKm}`);
  console.log(`  globalMode        : ${vpref?.globalMode}`);
  console.log(`  openTo (genders)  : ${vpref?.genders.length ? vpref.genders.join(", ") : "(empty = everyone)"}`);

  // loadViewer's own bail-out conditions
  const viewerBlockers: string[] = [];
  if (viewer.status !== "ACTIVE") viewerBlockers.push(`status is ${viewer.status}, not ACTIVE`);
  if (!vp) viewerBlockers.push("no profile row");
  if (vp?.onboardingStep) viewerBlockers.push(`onboardingStep = ${vp.onboardingStep} (onboarding incomplete)`);
  if (!vpref) viewerBlockers.push("no preference row");
  if (viewerBlockers.length) {
    console.log(h("F. ZERO-CANDIDATE CAUSE — viewer is rejected before any query runs"));
    viewerBlockers.forEach((b) => console.log(`  ✗ ${b}`));
    console.log("  getDiscoveryFeed() returns [] immediately (loadViewer bail-out).");
    return;
  }

  const viewerCompat = toCompat(viewer);

  // ── personas ──────────────────────────────────────────────────────────────
  const personas = await db.user.findMany({
    where: { email: { endsWith: "@people.lunova-staging.app" } },
    select: { ...sel, email: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(h(`D. STAGING PERSONAS IN THIS DATABASE: ${personas.length}`));
  if (personas.length === 0) {
    console.log("  ✗ No personas. Seed them:");
    console.log("      APP_ENV=staging SEED_STAGING=1 npm run db:seed:staging");
    return;
  }

  const [blocks, acted] = await Promise.all([
    db.block.findMany({
      where: { OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }] },
      select: { blockerId: true, blockedId: true },
    }),
    db.like.findMany({ where: { actorId: viewer.id }, select: { targetId: true, kind: true } }),
  ]);
  const blockedIds = new Set(
    blocks.map((b) => (b.blockerId === viewer.id ? b.blockedId : b.blockerId)),
  );
  const actedMap = new Map(acted.map((a) => [a.targetId, a.kind]));

  // Viewer's SQL age window, exactly as service.ts computes it.
  const now = new Date();
  const oldest = new Date(now);
  oldest.setFullYear(oldest.getFullYear() - vpref!.maxAge - 1);
  const youngest = new Date(now);
  youngest.setFullYear(youngest.getFullYear() - vpref!.minAge);

  type Verdict = { name: string; email: string; age: number; gender: string; city: string; stage: string; detail: string };
  const verdicts: Verdict[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  for (const c of personas) {
    const cp = c.profile;
    const age = ageFromBirthdate(c.birthdate);
    const base = {
      name: cp?.displayName ?? "?",
      email: c.email,
      age,
      gender: cp?.gender ?? "—",
      city: cp?.city ?? "—",
    };
    const verdict = (stage: string, detail: string) => {
      verdicts.push({ ...base, stage, detail });
      bump(stage);
    };

    // stage order mirrors getDiscoveryFeed
    if (c.status !== "ACTIVE") { verdict("1 status", `status=${c.status}`); continue; }
    if (blockedIds.has(c.id)) { verdict("2 blocked", "block row exists"); continue; }
    if (actedMap.has(c.id)) { verdict("3 already-acted", `you already ${actedMap.get(c.id)}d them`); continue; }
    if (c.birthdate < oldest || c.birthdate > youngest) {
      verdict("4 your age band", `they are ${age}, you accept ${vpref!.minAge}-${vpref!.maxAge}`);
      continue;
    }
    if (vpref!.genders.length && !vpref!.genders.includes(cp!.gender as never)) {
      verdict("5 your gender filter", `they are ${cp!.gender}, you accept ${vpref!.genders.join("/")}`);
      continue;
    }
    if (c.privacy?.profileVisibility === "PAUSED") { verdict("6 their privacy", "profileVisibility=PAUSED"); continue; }
    if (c.privacy?.discoveryPaused) { verdict("6 their privacy", "discoveryPaused=true"); continue; }
    if (c.privacy?.incognito) { verdict("6 their privacy", "incognito=true"); continue; }
    if (c.privacy?.profileVisibility === "LIMITED") { verdict("6 their privacy", "profileVisibility=LIMITED (needs their like first)"); continue; }
    if (cp?.onboardingStep) { verdict("7 their onboarding", `onboardingStep=${cp.onboardingStep}`); continue; }
    if (!cp?.photos.length) { verdict("8 no approved photo", "0 APPROVED photos"); continue; }

    // ── real engine from here ──
    const cc = toCompat(c as Row);
    const viewerAcceptsThem = meetsPreferences(viewerCompat, cc);
    const theyAcceptViewer = meetsPreferences(cc, viewerCompat);
    if (!viewerAcceptsThem || !theyAcceptViewer) {
      const why: string[] = [];
      if (!viewerAcceptsThem) why.push(`you reject them (age ${age} vs your ${vpref!.minAge}-${vpref!.maxAge}${vpref!.genders.length ? `, gender ${cp.gender} vs ${vpref!.genders.join("/")}` : ""})`);
      if (!theyAcceptViewer) {
        why.push(
          `THEY reject you (you are ${ageFromBirthdate(viewer.birthdate)} vs their ${c.preference?.minAge}-${c.preference?.maxAge}` +
            `${c.preference?.genders.length ? `, your gender ${vp!.gender} vs their ${c.preference.genders.join("/")}` : ""})`,
        );
      }
      verdict("9 mutual eligibility", why.join(" AND "));
      continue;
    }

    const result = computeCompatibility(viewerCompat, cc);
    const bothLocal = !vpref!.globalMode && !c.preference?.globalMode;
    if (bothLocal && result.distanceKm != null) {
      const reach = Math.max(vpref!.maxDistanceKm, c.preference?.maxDistanceKm ?? 0) + 1;
      if (result.distanceKm > reach) {
        verdict("10 distance", `${Math.round(result.distanceKm)}km apart, reach ${reach}km (yours ${vpref!.maxDistanceKm}, theirs ${c.preference?.maxDistanceKm})`);
        continue;
      }
    }
    verdicts.push({ ...base, stage: "✓ SURVIVES", detail: `score ${result.score.toFixed(3)} · ${result.label}` });
    bump("✓ SURVIVES");
  }

  console.log("  name       age gender        city      verdict");
  for (const v of verdicts) {
    console.log(
      `  ${v.name.padEnd(10)} ${String(v.age).padEnd(3)} ${v.gender.padEnd(13)} ${v.city.padEnd(9)} ${v.stage} — ${v.detail}`,
    );
  }

  console.log(h("E. EXCLUDED BY EACH FILTER (in evaluation order)"));
  for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${String(n).padStart(3)}  ${k}`);

  const survivors = counts["✓ SURVIVES"] ?? 0;
  console.log(h("F. RESULT"));
  if (survivors > 0) {
    console.log(`  ${survivors} candidate(s) SHOULD appear in Discovery for ${email}.`);
    console.log("  If the UI still shows the empty state, the app is not reading this database.");
  } else {
    const primary = Object.entries(counts)
      .filter(([k]) => k !== "✓ SURVIVES")
      .sort()[0];
    console.log(`  0 candidates. PRIMARY filter: ${primary?.[0]} (removed ${primary?.[1]})`);
    console.log("  Per-persona reasons are in the table above.");
  }
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
