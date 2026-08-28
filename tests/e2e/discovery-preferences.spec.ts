import { test, expect, type Page } from "@playwright/test";
import { createOnboardedUser, deleteUser } from "./_db";

const EMAIL = `e2e-pref-${Date.now()}@demo.lunova.local`;

test.describe("discovery preferences", () => {
  // Two full page loads plus /profile/edit (9 DB-backed sections). Give it room.
  test.describe.configure({ timeout: 60_000 });
  test.afterAll(() => deleteUser(EMAIL));

  // The App Router streams RSC payloads, so an element can briefly exist twice
  // (streamed + reconciled) mid-transition. `.first()` keeps strict-mode happy
  // while Playwright auto-waits for the real one to become visible.
  const emptyState = (page: Page) =>
    page.getByRole("heading", { name: "No one new right now" }).first();

  test("change preferences → save → reload persists → Discovery reflects them", async ({
    page,
  }) => {
    // A 30yo in Lisbon whose stored prefs are deliberately too narrow to match
    // anyone (age 20–22, WOMAN-only) — Discovery should be empty to start.
    const { email, password } = await createOnboardedUser(EMAIL, {
      age: 30,
      gender: "WOMAN",
      pref: { minAge: 20, maxAge: 22, maxDistanceKm: 20, genders: ["WOMAN"], globalMode: false },
    });

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await Promise.all([
      page.waitForURL(/\/(discover|onboarding|verify)/),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);

    // Discovery starts empty — the empty state is shown, not hidden.
    await page.goto("/discover");
    await expect(emptyState(page)).toBeVisible();

    // Widen preferences: age 18–99, enable worldwide (this DISABLES the distance
    // input, so it isn't submitted — the case that used to silently fail), and
    // clear the gender filter.
    await page.goto("/profile/edit");
    const prefs = page.locator("#preferences");
    await expect(prefs.locator('input[name="minAge"]').first()).toBeVisible({ timeout: 20_000 });
    await prefs.locator('input[name="minAge"]').first().fill("18");
    await prefs.locator('input[name="maxAge"]').first().fill("99");
    await prefs.locator('input[name="globalMode"]').first().check();
    await expect(prefs.locator('input[name="maxDistanceKm"]').first()).toBeDisabled();
    // clear the "Woman" chip so the gender filter is empty
    const womanChip = prefs.getByRole("switch", { name: "Woman", exact: true }).first();
    if ((await womanChip.getAttribute("aria-checked")) === "true") {
      await womanChip.click();
    }
    await prefs.getByRole("button", { name: "Save" }).first().click();
    await expect(prefs.getByText("Saved").first()).toBeVisible({ timeout: 15_000 });

    // Reload the edit page — the widened values must have persisted.
    await page.reload();
    const prefs2 = page.locator("#preferences");
    await expect(prefs2.locator('input[name="minAge"]').first()).toHaveValue("18");
    await expect(prefs2.locator('input[name="maxAge"]').first()).toHaveValue("99");
    await expect(prefs2.locator('input[name="globalMode"]').first()).toBeChecked();

    // Discovery now returns eligible seeded candidates.
    await page.goto("/discover");
    await expect(
      page.getByRole("heading", { name: /,\s*\d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(emptyState(page)).toHaveCount(0);
  });
});
