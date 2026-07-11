import { test, expect } from "@playwright/test";

const apiURL = process.env.API_URL ?? process.env.E2E_API_URL ?? "http://localhost:3000";

test.describe("smoke", () => {
  test("api health is ok", async ({ request }) => {
    const res = await request.get(`${apiURL}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("web home loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
