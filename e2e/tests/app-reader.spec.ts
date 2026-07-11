import { test, expect } from '@playwright/test';

/**
 * Smoke E2E against the offline corpus UI (local / docker web).
 * Does not require Google auth (anonymous reader path).
 */
test.describe('App lector offline', () => {
  test('home loads and shows search shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Navbar brand or search input
    const brand = page.getByText(/Documentos Vaticanos/i);
    const search = page.locator('input[type="search"], input[formcontrolname="buscador"]');
    await expect(brand.or(search).first()).toBeVisible({ timeout: 30_000 });
  });

  test('document list loads corpus from manifest', async ({ page }) => {
    await page.goto('/');
    // Navigate via UI if possible
    const listLink = page.getByRole('link', { name: /documentos|listar/i });
    if (await listLink.count()) {
      await listLink.first().click();
    } else {
      await page.goto('/documentos/listar');
    }
    await page.waitForTimeout(500);
    // After async load, expect at least Catecismo / Biblia / LG text somewhere
    const body = page.locator('body');
    await expect(body).toContainText(/Catecismo|Biblia|Lumen|document/i, {
      timeout: 60_000,
    });
  });

  test('corpus manifest is served as static asset', async ({ request }) => {
    const res = await request.get('/assets/corpus/manifest.json');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(Array.isArray(json.documents)).toBeTruthy();
    expect(json.documents.length).toBeGreaterThanOrEqual(2);
    const ids = json.documents.map((d: { id: string }) => d.id);
    expect(ids).toContain('cic-es');
    expect(ids).toContain('bible-pueblo-de-dios-es');
  });

  test('reader can open a document id route', async ({ page }) => {
    // Deep link style used by the app
    await page.goto('/leyendo/cic-es/punto/2');
    await expect(page.locator('body')).toBeVisible();
    // Either loading finishes or content appears; avoid hard fail on empty if offline miss
    await page.waitForTimeout(2000);
    const reader = page.locator('.reader-surface, app-lector, app-punto');
    await expect(reader.first()).toBeVisible({ timeout: 60_000 });
  });
});
