import { defineConfig, devices } from "@playwright/test";

/**
 * Visual-regression config for the navbar/header.
 *
 * - Runs against `bun run dev` on http://localhost:5173.
 * - Snapshots are stored next to the spec under `__screenshots__/`.
 * - First run writes baselines; subsequent runs diff at maxDiffPixelRatio.
 * - To intentionally update baselines: `bun run test:visual:update`.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--disable-blink-features=AutomationControlled"] },
      },
    },
    // WebKit covers iOS-like rendering (Safari engine) — critical for
    // catching safe-area / overlap regressions that only manifest on iOS.
    // Scoped to motion-toggle since navbar baselines are chromium-only.
    {
      name: "webkit",
      testMatch: /motion-toggle\.spec\.ts$/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "firefox",
      testMatch: /motion-toggle\.spec\.ts$/,
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  expect: {
    // Allow a tiny amount of subpixel/font-rendering noise without
    // failing — anything bigger means a real layout shift or overflow.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});