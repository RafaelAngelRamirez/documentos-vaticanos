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
    await page.goto('/biblioteca');
    await expect(page.getByText(/Biblioteca/i).first()).toBeVisible({
      timeout: 30_000,
    });
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
    await page.goto('/leyendo/cic-es/punto/2');
    await expect(page.locator('app-lector')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.rpaper, .rtxt, app-punto').first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator('.bnav')).toHaveCount(0);
  });
});
