/**
 * DB integration for Discovery-preference persistence via the edit-mode step
 * action. RUN_DB_TESTS=1.
 *
 * Regression cover for: preferences saved from Profile -> Discovery preferences
 * must actually persist, including when "worldwide" is enabled (which disables
 * the distance input in the UI, so the field is not submitted).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const RUN = process.env.RUN_DB_TESTS === "1";
const d = RUN ? describe : describe.skip;

d("discovery preferences persistence (DB)", () => {
  let db: typeof import("@/lib/db").db;
  let userId = "";
  const tag = `pref-${Date.now()}`;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    const u = await db.user.create({
      data: {
        email: `${tag}@demo.lunova.local`,
        passwordHash: "x",
        birthdate: new Date(1998, 0, 1),
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        // mirror the reported state: narrow age band, short distance, WOMAN-only
        preference: {
          create: { minAge: 20, maxAge: 25, maxDistanceKm: 20, genders: ["WOMAN"], globalMode: false },
        },
        privacy: { create: {} },
        trust: { create: {} },
        notificationPref: { create: {} },
        profile: {
          create: { displayName: "PrefTester", gender: "WOMAN", onboardingStep: null },
        },
      },
      select: { id: true },
    });
    userId = u.id;

    vi.doMock("@/lib/auth/dal", () => ({
      requireUser: async () => ({ id: userId, email: `${tag}@demo.lunova.local`, role: "USER" }),
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: () => {} }));
    vi.doMock("next/navigation", () => ({
      redirect: (url: string) => {
        throw new Error(`unexpected redirect to ${url}`);
      },
    }));
  });

  afterAll(async () => {
    vi.resetModules();
    if (userId) await db.user.deleteMany({ where: { id: userId } });
  });

  async function saveEdit(fields: Record<string, string | string[]>) {
    const { saveStepAction } = await import("./actions");
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
      else fd.append(k, v);
    }
    return saveStepAction("preferences", "edit", {}, fd);
  }

  it("persists a widened age range + distance (worldwide off)", async () => {
    const res = await saveEdit({
      minAge: "26",
      maxAge: "45",
      maxDistanceKm: "150",
      genders: ["WOMAN", "MAN", "NONBINARY"],
      // globalMode omitted = off
    });
    expect(res.saved).toBe(true);

    const pref = await db.preference.findUnique({ where: { userId } });
    expect(pref).toMatchObject({
      minAge: 26,
      maxAge: 45,
      maxDistanceKm: 150,
      globalMode: false,
    });
    expect(new Set(pref!.genders)).toEqual(new Set(["WOMAN", "MAN", "NONBINARY"]));
    // the action response reflects the actual persisted row
    expect(res.persisted).toMatchObject({ minAge: 26, maxAge: 45, maxDistanceKm: 150 });
  });

  it("persists when worldwide is enabled (distance field not submitted by the UI)", async () => {
    const before = await db.preference.findUnique({ where: { userId } });
    const res = await saveEdit({
      minAge: "24",
      maxAge: "50",
      // maxDistanceKm intentionally absent — the disabled input isn't submitted
      genders: ["WOMAN"],
      globalMode: "on",
    });
    expect(res.saved).toBe(true);

    const pref = await db.preference.findUnique({ where: { userId } });
    expect(pref).toMatchObject({ minAge: 24, maxAge: 50, globalMode: true });
    // distance keeps its previous stored value rather than blocking the save
    expect(pref!.maxDistanceKm).toBe(before!.maxDistanceKm);
  });

  it("rejects an inverted age range without writing", async () => {
    const before = await db.preference.findUnique({ where: { userId } });
    const res = await saveEdit({
      minAge: "40",
      maxAge: "30",
      maxDistanceKm: "100",
      genders: ["WOMAN"],
    });
    expect(res).toHaveProperty("fieldErrors");
    const after = await db.preference.findUnique({ where: { userId } });
    expect(after).toEqual(before);
  });
});
