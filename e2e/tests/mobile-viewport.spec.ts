import { expect, type Page, test } from '@playwright/test';

/**
 * Phone layout smoke at 390×844 (project mobile-390).
 * Portada, lector, biblioteca, document cover, offline reading history,
 * browser back hierarchy, and Sal 15 shown-number.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const prefs = {
      theme: 'mono',
      font: 'serif',
      fontSizePx: 18,
      lineHeight: 1.65,
      maxWidthCh: 65,
      keepAwake: false,
      contentLocale: 'es',
      uiLocale: 'es',
    };
    localStorage.setItem('reader.prefs.v1', JSON.stringify(prefs));
  });
});

test.describe('viewport móvil 390×844', () => {
  test('portada sin puntos de carrusel', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/inicio');
    await expect(page.locator('.wtitle')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.dots')).toHaveCount(0);
    await expect(page.locator('.dotp')).toHaveCount(0);
    await expect(page.locator('button.primary.wbtn')).toBeVisible();
    await expect(page.locator('[data-testid="inicio-lecturas"]')).toBeVisible();
  });

  test('lector', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/leyendo/cic-es/punto/2');
    await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/2/, { timeout: 60_000 });
    await expect(page.locator('app-lector')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('app-punto').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.bnav')).toHaveCount(0);
    const inner = await page.evaluate(() => window.innerWidth);
    expect(inner).toBeLessThan(1024);
  });

  test('lector selección sin menú nativo apilado', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () =>
          'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      });
    });
    await page.goto('/leyendo/cic-es/punto/2');
    await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/2/, { timeout: 60_000 });
    const rich = page.locator('app-punto[data-unit="7"]');
    await expect(rich).toBeVisible({ timeout: 60_000 });

    const selected = await rich.evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Text | null = null;
      while (walker.nextNode()) {
        const cur = walker.currentNode as Text;
        if (cur.textContent && cur.textContent.trim().length >= 24) {
          node = cur;
          break;
        }
      }
      if (!node || !node.textContent) return false;
      const start = node.textContent.search(/\S/);
      if (start < 0) return false;
      const end = Math.min(start + 40, node.textContent.length);
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return sel.toString().trim().length >= 3;
    });
    expect(selected).toBe(true);

    await expect(page.locator('.selpop')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.selpop')).toContainText('Copiar');
    const collapsed = await page.evaluate(() => {
      const sel = window.getSelection();
      return !sel || sel.isCollapsed || sel.rangeCount === 0;
    });
    expect(collapsed).toBe(true);
  });

  test('biblioteca', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/biblioteca');
    const mobile = page.locator('.only-mobile');
    await expect(mobile.getByText('Biblioteca', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    const host = page.locator('app-bnav');
    await expect(host).toHaveCSS('display', 'block');
    const bar = page.locator('.bnav');
    await expect(bar).toBeVisible();
    const height = await bar.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(0);
    await expect(mobile).not.toHaveCSS('display', 'none');
    await expect(page.locator('.only-desktop').first()).toHaveCSS('display', 'none');
  });

  test('atrás recorre la app y no sale', async ({ page }) => {
    test.setTimeout(120_000);
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

    await page.goto('/inicio');
    await expect(page.getByTestId('inicio-lectio-open')).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId('inicio-lectio-open').click();
    await expect(page).toHaveURL(/\/lectio$/);
    await expect(page.getByRole('heading', { name: 'Lectio divina', level: 1 })).toBeVisible();
    await pressBrowserBack(page);
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByTestId('inicio-lectio-open')).toBeVisible();

    await page.locator('button.primary.wbtn').click();
    await expect(page).toHaveURL(/\/biblioteca$/);
    const catecismo = page
      .locator('.only-mobile button.srow')
      .filter({ hasText: 'Catecismo de la Iglesia Católica' })
      .first();
    await expect(catecismo).toBeVisible({ timeout: 30_000 });
    await catecismo.click();
    await expect(page).toHaveURL(/\/documento\/cic-es$/);
    await expect(page.locator('app-documento-detalle')).toBeVisible();

    const empezar = page
      .locator('.rc-ctas-mobile')
      .getByRole('button', { name: /^(Empezar|Continuar)$/ });
    await expect(empezar).toBeVisible({ timeout: 30_000 });
    await empezar.click();
    await expect(page).toHaveURL(/\/leyendo\/cic-es\//, { timeout: 60_000 });
    await expect(page.locator('app-lector')).toBeVisible();
    await expect(page.locator('app-punto').first()).toBeVisible({ timeout: 60_000 });

    await page
      .locator('.only-mobile')
      .getByRole('button', { name: 'Ajustes de lectura' })
      .click();
    await expect(page.locator('dv-sheet')).toBeVisible();
    await pressBrowserBack(page);
    await expect(page.locator('dv-sheet')).toHaveCount(0);
    await expect(page).toHaveURL(/\/leyendo\/cic-es\//);
    await expect(page.locator('app-punto').first()).toBeVisible();

    await pressBrowserBack(page);
    await expect(page).toHaveURL(/\/documento\/cic-es$/);
    await expect(page.locator('app-documento-detalle')).toBeVisible();
    await expect(
      page.locator('.only-mobile').getByRole('button', { name: '← Biblioteca' }),
    ).toBeVisible();

    await pressBrowserBack(page);
    await expect(page).toHaveURL(/\/biblioteca$/);
    await expect(page.locator('.only-mobile button.srow').first()).toBeVisible();

    await pressBrowserBack(page);
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByTestId('inicio-lectio-open')).toBeVisible();

    await pressBrowserBack(page);
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.locator('.dv-toast')).toContainText('salir');
  });

  test('búsqueda en frío vuelve a inicio', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/buscar');
    await expect(
      page.getByRole('searchbox', {
        name: 'Búsqueda en el texto: palabra, frase o intención',
      }),
    ).toBeVisible({ timeout: 30_000 });
    await pressBrowserBack(page);
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByTestId('inicio-lectio-open')).toBeVisible();
    await expect(page.locator('app-root')).toBeVisible();
  });

  test('portada de documento', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/documento/cic-es');
    await expect(page).toHaveURL(/\/documento\/cic-es/, { timeout: 30_000 });
    await expect(page.locator('app-reading-cover')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('app-cover-header')).toHaveCount(1);
    await expect(page.locator('app-reading-cover .dcover')).toHaveCount(0);
    const title = page.locator('app-cover-header .web-title');
    await expect(title).toHaveText('Catecismo de la Iglesia Católica');

    const estudio = page.locator('details.estudio');
    await expect(estudio).toBeVisible();
    await expect(estudio).toHaveJSProperty('open', false);
    await expect(estudio.locator('.estudio-lede')).toBeHidden();
    await expect(page.locator('app-meta-grid .meta2')).toBeHidden();
    const beforeOpen = page.url();
    await estudio.locator('summary').click();
    await expect(page).toHaveURL(beforeOpen);
    await expect(estudio).toHaveJSProperty('open', true);
    await expect(estudio.locator('.estudio-lede')).toHaveText(
      'Información extra de esta obra',
    );
    await expect(estudio.getByText('Ficha', { exact: true })).toBeVisible();
    await expect(estudio.getByText('Fuente', { exact: true })).toBeVisible();

    const meta = page.locator('app-meta-grid .meta2');
    await expect(meta).toBeVisible();
    const edges = await page.evaluate(() => {
      const titleEl = document.querySelector('app-cover-header .web-title');
      const metaEl = document.querySelector('app-meta-grid .meta2');
      if (!titleEl || !metaEl) return null;
      const titleBox = titleEl.getBoundingClientRect();
      const metaBox = metaEl.getBoundingClientRect();
      return {
        titleLeft: titleBox.left,
        metaLeft: metaBox.left,
        align: getComputedStyle(titleEl).textAlign,
      };
    });
    expect(edges).not.toBeNull();
    expect(Math.abs(edges!.titleLeft - edges!.metaLeft)).toBeLessThanOrEqual(1);
    expect(['start', 'left']).toContain(edges!.align);
  });

  test('Sal 15 no repite el versículo', async ({ page }) => {
    test.setTimeout(120_000);
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/leyendo/bible-pueblo-de-dios-es/punto/15400');
    await expect(page).toHaveURL(/\/leyendo\/bible-pueblo-de-dios-es\/u\/15400/, {
      timeout: 90_000,
    });
    const verse = page.locator('p.punto-contenido[data-unit="15400"]');
    await expect(verse).toBeVisible({ timeout: 90_000 });
    const text = (await verse.innerText()).replace(/\s+/g, ' ').trim();
    expect(text).toMatch(/Sal 15, 2\.\s*El que procede/);
    expect(text).not.toMatch(/Sal 15, 2\.\s*2\b/);
    await expect(page.locator('.bnav')).toHaveCount(0);
    const inner = await page.evaluate(() => window.innerWidth);
    expect(inner).toBeLessThan(1024);
  });

  test('historial', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

    await page.goto('/leyendo/cic-es/u/2');
    await expect(page.locator('app-punto').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('dv.readingHistory.v1');
      if (!raw) return false;
      const list = JSON.parse(raw) as { documentId?: string; unitIndex?: number }[];
      return list.some((row) => row.documentId === 'cic-es' && row.unitIndex === 2);
    });

    await page.goto('/leyendo/lg-es/u/1');
    await expect(page.locator('app-punto').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('dv.readingHistory.v1');
      if (!raw) return false;
      const list = JSON.parse(raw) as { documentId?: string }[];
      return list[0]?.documentId === 'lg-es' && list[1]?.documentId === 'cic-es';
    });

    await page.goto('/biblioteca');
    await page.getByTestId('bnav-historial').click();
    await expect(page).toHaveURL(/\/historial/);
    const items = page.getByTestId('history-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute('data-document-id', 'lg-es');
    await expect(items.nth(1)).toHaveAttribute('data-document-id', 'cic-es');
    await expect(items.nth(1)).toHaveAttribute('data-unit-index', '2');
    await expect(page.getByTestId('history-clear')).toBeVisible();

    await items.nth(1).click();
    await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/2/, { timeout: 60_000 });
    await expect(page.locator('app-lector')).toBeVisible();
    await expect(page.locator('app-punto').first()).toBeVisible({ timeout: 60_000 });
  });
});

/** Browser/Android back. Stays on this origin: the gesture must not unload the SPA. */
async function pressBrowserBack(page: Page): Promise<void> {
  const before = page.url();
  expect(before.startsWith('http')).toBe(true);
  await page.evaluate(() => history.back());
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe('about:blank');
  expect(new URL(page.url()).origin).toBe(new URL(before).origin);
}
