import { test, expect, type Page } from "@playwright/test";
import { clearInteractions, deleteUser, seedLike, setEmailCode } from "./_db";

const DEMO_PW = "lunova-demo-pass";
const MAYA = "maya@demo.lunova.local";
const ARJUN = "arjun@demo.lunova.local";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PW);
  await Promise.all([
    page.waitForURL(/\/(discover|onboarding|verify)/),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
}

test.describe("golden path", () => {
  test("sign up → verify email → land in onboarding", async ({ page }) => {
    const email = `e2e-${Date.now()}@demo.lunova.local`;
    try {
      await page.goto("/signup");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel(/^password/i).fill("e2e-pass-123");
      await page.getByLabel("Date of birth").fill("1996-05-04");
      await page.getByLabel(/I'm 18\+/).check();
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page).toHaveURL(/\/verify$/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

      expect(await setEmailCode(email, "424242")).toBe(true);
      await page.getByLabel("Verification code").fill("424242");
      await page.getByRole("button", { name: "Verify email" }).click();
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    } finally {
      await deleteUser(email);
    }
  });

  test("log in → discover → log out", async ({ page }) => {
    await login(page, MAYA);
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();

    await page.goto("/settings");
    await Promise.all([
      page.waitForURL(/localhost:\d+\/$/),
      page.getByRole("button", { name: "Sign out" }).click(),
    ]);
  });

  test("mutual like creates a match and opens a conversation", async ({ page }) => {
    await clearInteractions([MAYA, ARJUN]);
    await seedLike(ARJUN, MAYA);

    await login(page, MAYA);
    await page.goto("/discover");

    await expect(page.getByRole("heading", { name: /Arjun, \d+/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Like", exact: true }).click();

    await expect(page.getByText("You found something in common")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: "Send a message" }).click();
    await page.waitForURL(/\/connections\//);

    const box = page.getByRole("textbox", { name: /Message Arjun/ });
    await box.fill("that slow-down line got me");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("that slow-down line got me")).toBeVisible();

    await clearInteractions([MAYA, ARJUN]);
  });

  test("safety controls are present on a conversation", async ({ page }) => {
    await clearInteractions([MAYA, ARJUN]);
    await seedLike(ARJUN, MAYA);

    await login(page, MAYA);
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: /Arjun, \d+/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Like", exact: true }).click();
    await page.getByRole("link", { name: "Send a message" }).click();
    await page.waitForURL(/\/connections\//);

    await page.getByRole("button", { name: "Safety options" }).click();
    await expect(page.getByRole("menuitem", { name: "Unmatch" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Report" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Block" })).toBeVisible();

    await clearInteractions([MAYA, ARJUN]);
  });
});
