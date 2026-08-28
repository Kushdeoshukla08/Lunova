import { test, expect, type Page } from "@playwright/test";
import { createOnboardedUser, db, deleteUser } from "./_db";

/**
 * Mobile-first regression net.
 *
 * Two classes of bug are invisible in review and obvious on a phone: a row that
 * pushes the page sideways, and a control too small to hit. Both are cheap to
 * measure and expensive to notice by hand, so they are asserted here rather
 * than left to a manual pass.
 *
 * 320px is the narrowest width still in real use (iPhone SE 1st gen, and any
 * phone at 200% text zoom); 390 and 430 are the current iPhone sizes.
 */
const EMAIL = `e2e-responsive-${Date.now()}@demo.lunova.local`;

/** WCAG 2.2 SC 2.5.8, level AA. */
const MIN_TARGET = 24;

const PAGES = [
  "/discover",
  "/connections",
  "/activity",
  "/notifications",
  "/profile",
  "/profile/edit",
  "/settings",
  "/settings/privacy",
  "/settings/notifications",
  "/settings/security",
  "/settings/account",
  "/settings/blocked",
  "/settings/language",
];

interface Offender {
  label: string;
  w: number;
  h: number;
}

/**
 * Every interactive control that is smaller than the minimum, excluding the two
 * cases the success criterion itself exempts: controls whose size is set by the
 * line-height of surrounding sentence text, and controls that are visually
 * hidden until focused (the skip link).
 */
async function undersizedTargets(page: Page): Promise<Offender[]> {
  return page.evaluate((min) => {
    const out: { label: string; w: number; h: number }[] = [];
    const selector =
      'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=switch],[role=menuitem]';
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;

      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;

      // A native input inside its <label> is activated by the whole label, so
      // the label is the real target.
      if (el.tagName === "INPUT" && el.closest("label")) continue;

      const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40);

      // Visually-hidden-until-focused controls (1x1 clip pattern).
      if (r.width <= 1 && r.height <= 1) continue;

      // SC 2.5.8 "inline" exception: a link sitting inside a sentence, where the
      // line box — not the author — decides its height.
      const inlineLink =
        el.tagName === "A" &&
        cs.display.startsWith("inline") &&
        (el.parentElement?.textContent ?? "").trim().length > label.length + 4;
      if (inlineLink) continue;

      // The ::after hit-area expander (.tap-target) counts toward the target.
      let w = r.width;
      let h = r.height;
      const after = getComputedStyle(el, "::after");
      if (after.content !== "none") {
        w = Math.max(w, parseFloat(after.width) || 0);
        h = Math.max(h, parseFloat(after.height) || 0);
      }
      if (w < min || h < min) out.push({ label, w: Math.round(w), h: Math.round(h) });
    }
    return out;
  }, MIN_TARGET);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= vw + 1) return null;
    const culprits: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        culprits.push(
          `${el.tagName}.${String(el.className).slice(0, 30)} right=${Math.round(r.right)} "${(el.textContent ?? "").trim().slice(0, 30)}"`,
        );
      }
      if (culprits.length >= 5) break;
    }
    return { scrollWidth: document.documentElement.scrollWidth, vw, culprits };
  });
}

test.describe("mobile layout + touch targets", () => {
  test.describe.configure({ timeout: 120_000 });
  test.afterAll(() => deleteUser(EMAIL));

  let creds: { email: string; password: string };

  test.beforeAll(async () => {
    creds = await createOnboardedUser(EMAIL, {
      age: 29,
      gender: "WOMAN",
      pref: { minAge: 18, maxAge: 99, globalMode: true },
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/login");
    await page.getByLabel("Email").fill(creds.email);
    await page.getByLabel("Password").fill(creds.password);
    await Promise.all([
      page.waitForURL(/\/(discover|onboarding|verify)/),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
  });

  test("no page scrolls sideways on any phone width", async ({ page }) => {
    // Resize and re-measure on one page load per route rather than navigating
    // 13 routes per width — layout re-runs on resize, and three passes of cold
    // route compilation is what made this the slowest spec in the suite.
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 812 });
        const overflow = await horizontalOverflow(page);
        expect(overflow, `${path} overflows at ${width}px`).toBeNull();
      }
    }
  });

  test("every control meets the 24px minimum target size", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const offenders = await undersizedTargets(page);
      expect(offenders, `${path} has targets under ${MIN_TARGET}px`).toEqual([]);
    }
  });

  test("form controls are 16px on phones so iOS does not zoom on focus", async ({ page }) => {
    // Safari zooms in — and never back out — when a focused control's text is
    // under 16px, which throws the whole layout off mid-signup.
    await page.goto("/profile/edit");
    const sizes = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea',
        ),
      ).map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );
    expect(sizes.length).toBeGreaterThan(3);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(16);
  });
});

test.describe("safety menu is operable without a mouse", () => {
  // Two account creations plus a login and a profile load; the default 30s is
  // not enough on a cold dev server sharing a machine with the rest of the run.
  test.describe.configure({ timeout: 90_000 });

  // Block and report are the controls that matter most to reach in a hurry.
  const EMAIL_A = `e2e-safety-a-${Date.now()}@demo.lunova.local`;
  const EMAIL_B = `e2e-safety-b-${Date.now()}@demo.lunova.local`;

  test.afterAll(async () => {
    await deleteUser(EMAIL_A);
    await deleteUser(EMAIL_B);
  });

  test("opens, cycles and closes with the keyboard alone", async ({ page }) => {
    const a = await createOnboardedUser(EMAIL_A, { age: 30, pref: { globalMode: true } });
    await createOnboardedUser(EMAIL_B, { age: 31, pref: { globalMode: true } });
    const b = await db.user.findUnique({ where: { email: EMAIL_B }, select: { id: true } });

    await page.goto("/login");
    await page.getByLabel("Email").fill(a.email);
    await page.getByLabel("Password").fill(a.password);
    await Promise.all([
      page.waitForURL(/\/(discover|onboarding|verify)/),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);

    // A member's profile page carries the same menu as the conversation header.
    await page.goto(`/u/${b!.id}`);
    const trigger = page.getByRole("button", { name: /^Safety options for / }).first();
    await expect(trigger).toBeVisible();

    await trigger.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    // Naming the menu is what tells a screen-reader user what it belongs to.
    await expect(menu).toHaveAttribute("aria-label", /Safety options for /);

    // Focus must land inside; the old build closed the menu the moment the
    // trigger lost focus, which made these items unreachable by keyboard.
    await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem").nth(1)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
