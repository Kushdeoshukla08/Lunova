import { test, expect, type Browser, type Page } from "@playwright/test";
import { clearInteractions, seedLike } from "./_db";

const DEMO_PW = "lunova-demo-pass";
const MAYA = "maya@demo.lunova.local";
const ARJUN = "arjun@demo.lunova.local";

async function signIn(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(discover|onboarding|verify)/);
  return page;
}

test.describe("real-time messaging", () => {
  test("a message sent by one person appears for the other without a reload", async ({
    browser,
  }) => {
    await clearInteractions([MAYA, ARJUN]);
    await seedLike(ARJUN, MAYA);

    const maya = await signIn(browser, MAYA);
    const arjun = await signIn(browser, ARJUN);

    // Maya likes back → match + conversation
    await maya.goto("/discover");
    await expect(maya.getByRole("heading", { name: /Arjun, \d+/ })).toBeVisible({
      timeout: 15_000,
    });
    await maya.getByRole("button", { name: "Like Arjun" }).click();
    await maya.getByRole("link", { name: "Say hi" }).click();
    await maya.waitForURL(/\/connections\//);
    const conversationUrl = new URL(maya.url()).pathname;

    // Arjun opens the same thread and just sits there
    await arjun.goto(conversationUrl);
    await expect(arjun.getByRole("textbox", { name: /Message Maya/ })).toBeVisible();

    // Maya sends — Arjun should receive it with no navigation of his own
    const line = `live check ${Date.now()}`;
    await maya.getByRole("textbox", { name: /Message Arjun/ }).fill(line);
    await maya.getByRole("button", { name: "Send" }).click();

    await expect(arjun.getByText(line)).toBeVisible({ timeout: 15_000 });

    // …and Maya's copy picks up a read receipt once Arjun's tab marks it read
    await expect(maya.locator("[data-read-receipt]").first()).toBeVisible({
      timeout: 15_000,
    });

    await clearInteractions([MAYA, ARJUN]);
    await maya.context().close();
    await arjun.context().close();
  });
});
