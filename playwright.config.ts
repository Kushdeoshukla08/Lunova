import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Shared CI runners are resource-constrained; the golden-path + realtime flows
  // (two contexts, SSE, a full match) are timing-sensitive. Retry on CI so one
  // slow run doesn't fail the job — a genuinely broken test still fails all 3.
  retries: CI ? 2 : 0,
  timeout: CI ? 45_000 : 30_000,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI builds first and runs the production server; locally we use dev.
    command: process.env.CI
      ? `npm run start -- -p ${PORT}`
      : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
