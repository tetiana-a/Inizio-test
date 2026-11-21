import { defineConfig, devices, type Project } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4173);

// Volitelně vlastní Chrome/Chromium (např. PW_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome),
// jinak Playwright použije svůj prohlížeč z `npx playwright install chromium`.
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

/**
 * Všechna zařízení běží v Chromiu s emulací daného zařízení
 * (rozměr viewportu, devicePixelRatio, dotyk, isMobile, user agent).
 * Pokrývá nejmenší telefon (iPhone SE, 320 px), běžné telefony, telefon na šířku,
 * tablety i desktopy až po 2560 px.
 */
const device = (name: string, use: Project["use"]): Project => ({
  name,
  use: { ...use, browserName: "chromium", launchOptions: { executablePath } },
});

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "cs-CZ",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    device("iPhone SE", devices["iPhone SE"]),
    device("iPhone 15 Pro Max", devices["iPhone 15 Pro Max"]),
    device("Pixel 7", devices["Pixel 7"]),
    device("Galaxy S24", devices["Galaxy S24"]),
    device("iPhone 15 landscape", devices["iPhone 15 landscape"]),
    device("iPad Mini", devices["iPad Mini"]),
    device("Galaxy Tab S9 landscape", devices["Galaxy Tab S9 landscape"]),
    device("Desktop 1280", { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } }),
    device("Desktop 1920", { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } }),
  ],
  webServer: {
    command: "npx tsx e2e/server.ts",
    url: `http://127.0.0.1:${PORT}/api/health`,
    env: { E2E_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
