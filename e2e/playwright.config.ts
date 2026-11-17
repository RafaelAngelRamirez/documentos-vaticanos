import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.BASE_URL ||
  "http://127.0.0.1:4200";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    // Dist smoke asserts Spanish UI text; the app follows the browser language.
    locale: "es-MX",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile-viewport\.spec\.ts/,
    },
    {
      // Canonical phone layout: 390×844. Lector + biblioteca smoke only.
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
      testMatch: /mobile-viewport\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_START_WEB
    ? {
        command:
          "cd ../frontend && npx ng serve --host 127.0.0.1 --port 4200 --configuration development",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
