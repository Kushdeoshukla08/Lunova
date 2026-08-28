import { test, expect } from "@playwright/test";
import { createOnboardedUser, deleteUser } from "./_db";

const EMAIL = `e2e-pref-${Date.now()}@demo.lunova.local`;

test.describe("discovery preferences", () => {
  // Cold-compiles /discover and /profile/edit (9 DB-backed sections) back to
  // back on the dev server — give it room on a busy machine / CI.
  test.describe.configure({ timeout: 60_000 });
  test.afterAll(() => deleteUser(EMAIL));

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
    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("No one new right now")).toBeVisible();

    // Widen preferences: age 18–99, enable worldwide (this DISABLES the distance
    // input, so it isn't submitted — the case that used to silently fail), and
    // clear the gender filter.
    await page.goto("/profile/edit", { waitUntil: "domcontentloaded" });
    const prefs = page.locator("#preferences");
    await expect(prefs.locator('input[name="minAge"]')).toBeVisible({ timeout: 20_000 });
    await prefs.locator('input[name="minAge"]').fill("18");
    await prefs.locator('input[name="maxAge"]').fill("99");
    // Enabling worldwide disables the distance input, so it isn't submitted —
    // the case that used to silently discard the whole save.
    await prefs.locator('input[name="globalMode"]').check();
    await expect(prefs.locator('input[name="maxDistanceKm"]')).toBeDisabled();
    // clear the "Woman" chip so the gender filter is empty
    const womanChip = prefs.getByRole("switch", { name: "Woman", exact: true });
    if ((await womanChip.getAttribute("aria-checked")) === "true") {
      await womanChip.click();
    }
    await prefs.getByRole("button", { name: "Save" }).click();
    await expect(prefs.getByText("Saved")).toBeVisible({ timeout: 15_000 });

    // Reload the edit page — the widened values must have persisted.
    await page.reload({ waitUntil: "domcontentloaded" });
    const prefs2 = page.locator("#preferences");
    await expect(prefs2.locator('input[name="minAge"]')).toHaveValue("18");
    await expect(prefs2.locator('input[name="maxAge"]')).toHaveValue("99");
    await expect(prefs2.locator('input[name="globalMode"]')).toBeChecked();

    // Discovery now returns eligible seeded candidates.
    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("No one new right now")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /,\s*\d+$/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
