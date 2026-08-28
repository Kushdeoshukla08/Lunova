/**
 * DB integration — authorization on the media route.
 *
 * Photo URLs are long-lived and get pasted into chats, bug reports and browser
 * history, so "knows the URL" must never be the same thing as "may see it".
 * Skipped unless RUN_DB_TESTS=1 (needs Postgres on :5433).
 *
 *   RUN_DB_TESTS=1 npx vitest run src/app/media
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

// The route resolves identity through the DAL; swap in a settable current user
// so each case can be replayed as a different viewer against real rows.
let viewerId: string | null = null;
vi.mock("@/lib/auth/dal", () => ({
  getCurrentUser: async () => (viewerId ? { id: viewerId } : null),
}));

d("GET /media/[...key] — authorization", () => {
  let db: typeof import("@/lib/db").db;
  let GET: typeof import("./[...key]/route").GET;

  const tag = `media-${Date.now()}`;
  const ids: string[] = [];
  const keys = {
    ownerApproved: `photos/${tag}/owner-approved.png`,
    ownerPending: `photos/${tag}/owner-pending.png`,
    blockerApproved: `photos/${tag}/blocker-approved.png`,
    bannedApproved: `photos/${tag}/banned-approved.png`,
  };
  let owner = "";
  let stranger = "";
  let blocker = "";

  async function member(name: string, status: "ACTIVE" | "BANNED" = "ACTIVE") {
    const u = await db.user.create({
      data: {
        email: `${tag}-${name}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1996, 0, 1),
        emailVerifiedAt: new Date(),
        status,
        preference: { create: { minAge: 18, maxAge: 99, maxDistanceKm: 500, genders: [] } },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: {
            displayName: name,
            gender: "NONBINARY",
            onboardingStep: null,
            relationshipIntent: "LONG_TERM",
            latitude: 38.72,
            longitude: -9.13,
          },
        },
      },
      select: { id: true, profile: { select: { id: true } } },
    });
    ids.push(u.id);
    return { id: u.id, profileId: u.profile!.id };
  }

  async function photo(profileId: string, storageKey: string, approved: boolean) {
    await db.photo.create({
      data: {
        profileId,
        storageKey,
        moderationStatus: approved ? "APPROVED" : "PENDING",
        position: 0,
      },
    });
  }

  async function call(key: string) {
    return GET(new Request(`http://localhost/media/${key}`), {
      params: Promise.resolve({ key: key.split("/") }),
    } as never);
  }

  async function fetchKey(key: string): Promise<number> {
    return (await call(key)).status;
  }

  /**
   * Real bytes on disk for every fixture key, so an authorized request returns
   * 200 and a denied one returns 404 — otherwise "forbidden" and "missing file"
   * would be indistinguishable and the assertions would prove nothing.
   */
  const uploadRoot = join(process.cwd(), process.env.STORAGE_LOCAL_DIR || ".uploads");
  const PIXEL = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ GET } = await import("./[...key]/route"));

    const o = await member("owner");
    const s = await member("stranger");
    const b = await member("blocker");
    const x = await member("banned", "BANNED");
    owner = o.id;
    stranger = s.id;
    blocker = b.id;

    await photo(o.profileId, keys.ownerApproved, true);
    await photo(o.profileId, keys.ownerPending, false);
    await photo(b.profileId, keys.blockerApproved, true);
    await photo(x.profileId, keys.bannedApproved, true);

    await db.block.create({ data: { blockerId: blocker, blockedId: stranger } });

    for (const key of Object.values(keys)) {
      const abs = join(uploadRoot, key);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, PIXEL);
    }
  });

  afterAll(async () => {
    await rm(join(uploadRoot, "photos", tag), { recursive: true, force: true }).catch(() => {});
    if (!db) return;
    await db.block.deleteMany({
      where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });

  it("refuses an anonymous request even for an approved photo", async () => {
    viewerId = null;
    expect(await fetchKey(keys.ownerApproved)).toBe(404);
  });

  it("refuses a key that does not resolve to a photo row", async () => {
    viewerId = stranger;
    expect(await fetchKey(`photos/${tag}/does-not-exist.png`)).toBe(404);
  });

  it("refuses prefixes that are never viewer-facing", async () => {
    viewerId = stranger;
    // Verification selfies live outside `photos/` and must stay unreachable
    // even for the person who uploaded them.
    expect(await fetchKey(`verification/${tag}/selfie.png`)).toBe(404);
  });

  it("refuses traversal and malformed keys before touching storage", async () => {
    viewerId = stranger;
    for (const key of ["photos/../../.env", "photos/./x.png", "photos/x%00.png"]) {
      expect(await fetchKey(key), key).toBe(404);
    }
  });

  it("serves an approved photo to an unrelated signed-in member", async () => {
    viewerId = stranger;
    const res = await call(keys.ownerApproved);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("hides a photo still in moderation from everyone but its owner", async () => {
    viewerId = stranger;
    expect(await fetchKey(keys.ownerPending)).toBe(404);
    viewerId = owner;
    expect(await fetchKey(keys.ownerPending)).toBe(200);
  });

  it("hides a photo from someone the owner has blocked, in both directions", async () => {
    viewerId = stranger; // blocked by `blocker`
    expect(await fetchKey(keys.blockerApproved)).toBe(404);
    viewerId = blocker; // the blocker gets the same treatment, not a one-way mute
    expect(await fetchKey(keys.ownerApproved)).toBe(200); // …but only for that pair
  });

  it("hides photos belonging to a banned account", async () => {
    viewerId = stranger;
    expect(await fetchKey(keys.bannedApproved)).toBe(404);
  });

  it("never lets a stored object be interpreted as an active document", async () => {
    viewerId = stranger;
    const res = await call(keys.ownerApproved);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    // Member photos are never shared-cacheable.
    expect(res.headers.get("cache-control")).toMatch(/^private,/);
  });
});
