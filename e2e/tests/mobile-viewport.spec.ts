import fs from 'node:fs';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * Phone layout smoke at 390×844 (project mobile-390).
 * Portada, lector, biblioteca, document cover, offline reading history,
 * browser back hierarchy, Sal 15 shown-number, and the cited-verse passage.
 */

const SHIP_CHUNK = 500;

/** Ship chunk: dense slice, no index_array, same placement as corpus-compress. */
function shipChunk(
  chunkIndex: number,
  byIndex: Record<number, unknown>,
): string {
  const start = chunkIndex * SHIP_CHUNK;
  const units = [];
  for (let i = 0; i < SHIP_CHUNK; i++) {
    const index = start + i;
    units.push(
      byIndex[index] || {
        consecutivo: String(index),
        contenido: `relleno ${index}`,
      },
    );
  }
  return JSON.stringify(units);
}

/** Translation unit: text at the Spanish index, no verse metadata. */
function plainBibleUnit(index: number, text: string) {
  return { consecutivo: String(index), contenido: text };
}

function coldBibleUnit(
  index: number,
  libro: string,
  chapter: number,
  verse: number,
  text: string,
) {
  return {
    index_array: index,
    consecutivo: String(index),
    contenido: `${verse} ${text}`,
    referencias: [],
    biblia: {
      libro,
      capitulo: String(chapter),
      versiculo: verse,
      consecutivo_versiculo: `${libro} ${chapter}, ${verse}`,
      index_general: String(index),
    },
  };
}

function bibleUnit(
  libro: string,
  chapter: string,
  verse: number,
  text: string,
) {
  return {
    consecutivo: `${libro} ${chapter}, ${verse}`,
    contenido: `${verse} ${text}`,
    referencias: [],
    biblia: {
      consecutivo_versiculo: `${chapter}, ${verse}`,
      versiculo: verse,
      capitulo: chapter,
      libro,
      index_general: String(verse),
    },
  };
}

const BIBLE_FIXTURE = [
  bibleUnit('apocalipsis', '3', 1, 'Escribe al Angel de la Iglesia de Sardes.'),
  bibleUnit('apocalipsis', '3', 6, 'El que pueda entender, que entienda lo que el Espíritu dice a las Iglesias.'),
  bibleUnit('apocalipsis', '3', 7, 'Escribe al Angel de la Iglesia de Filadelfia.'),
  bibleUnit('apocalipsis', '3', 13, 'Obligaré a los de la sinagoga de Satanás.'),
  bibleUnit('apocalipsis', '3', 14, 'Escribe al Angel de la Iglesia de Laodicea.'),
  bibleUnit('apocalipsis', '3', 22, 'El que pueda entender, que entienda lo que el Espíritu dice a las Iglesias.'),
  bibleUnit('evangelio segun san lucas', '19', 1, 'Jesús entró en Jericó y atravesaba la ciudad, donde estaba Zaqueo.'),
  bibleUnit('evangelio segun san lucas', '19', 5, 'Jesús le dijo: Zaqueo, baja pronto.'),
  bibleUnit('evangelio segun san lucas', '19', 10, 'El Hijo del hombre vino a buscar y a salvar lo que estaba perdido.'),
  bibleUnit('evangelio segun san lucas', '19', 11, 'Este versículo queda fuera de la cita.'),
];
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

  test('Amoris laetitia en inglés sigue después de Nº 1–2', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.goto('/leyendo/esortazione-ap-20160319-amoris-laetitia-en');
    await expect(page.locator('app-lector')).toBeVisible({ timeout: 60_000 });
    const head = page.locator('.rhead');
    await expect(head).toBeVisible({ timeout: 60_000 });
    await expect(head).not.toHaveText('Nº 1–2');
    await expect(page.locator('app-punto').first()).toContainText('The Joy of Love');
    await expect(page.locator('app-punto').nth(2)).toContainText(
      'time is greater than space',
    );
    const before = await page.locator('app-punto').count();
    expect(before).toBeGreaterThan(2);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => page.locator('app-punto').count(), { timeout: 20_000 })
      .toBeGreaterThan(before);
    await expect(head).toContainText(/Nº 1–1\d/);
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

  test.describe('búsqueda en frío', () => {
    test.use({ serviceWorkers: 'block' });

    test('gracia no espera el corpus entero', async ({ page }) => {
      test.setTimeout(60_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      const content: string[] = [];
      const indexes: string[] = [];
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('/content.json')) content.push(url);
        if (url.includes('/index.json')) indexes.push(url);
      });
      await page.goto('/buscar');
      const box = page.getByRole('searchbox', {
        name: 'Búsqueda en el texto: palabra, frase o intención',
      });
      await expect(box).toBeVisible();
      await box.fill('gracia');
      await expect(page.locator('.srow').first()).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText('Cargando documentos para la búsqueda…'),
      ).toHaveCount(0);
      expect(indexes, indexes.slice(0, 8).join('\n')).toEqual([]);
      expect(content.length).toBeGreaterThan(0);
      expect(content.length).toBeLessThanOrEqual(20);
    });

    test('mercy en inglés no espera el corpus entero ni duplica sedula', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await page.addInitScript(() => {
        localStorage.setItem(
          'reader.prefs.v1',
          JSON.stringify({
            theme: 'mono',
            font: 'serif',
            fontSizePx: 18,
            lineHeight: 1.65,
            maxWidthCh: 65,
            keepAwake: false,
            contentLocale: 'en',
            uiLocale: 'en',
          }),
        );
      });
      const content: string[] = [];
      const indexes: string[] = [];
      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('/content.json')) content.push(url);
        if (url.includes('/index.json')) indexes.push(url);
      });
      await page.goto('/buscar');
      // aria-label stays Spanish; contentLocale=en selects en.json shelves.
      const box = page.getByRole('searchbox', {
        name: 'Búsqueda en el texto: palabra, frase o intención',
      });
      await expect(box).toBeVisible({ timeout: 30_000 });
      const started = Date.now();
      await box.fill('mercy');
      await expect(page.locator('.srow').first()).toBeVisible({ timeout: 10_000 });
      const elapsed = Date.now() - started;
      expect(elapsed, `cold mercy painted in ${elapsed}ms`).toBeLessThan(10_000);
      await expect(
        page.getByText('Cargando documentos para la búsqueda…'),
      ).toHaveCount(0);
      expect(indexes, indexes.slice(0, 8).join('\n')).toEqual([]);
      expect(content.length).toBeGreaterThan(0);
      expect(content.length).toBeLessThanOrEqual(20);
      const sedula = page.locator('.srow', { hasText: /sedula mater/i });
      const sedulaCount = await sedula.count();
      if (sedulaCount > 0) {
        const labels = await sedula.allTextContents();
        const n6 = labels.filter((t) => /Nº\s*6/i.test(t) || /\b6\b/.test(t));
        expect(n6.length, n6.join(' | ')).toBeLessThanOrEqual(1);
      }
    });
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

  test.describe('pasaje citado', () => {
    // Block the SW so page.route can stub the bible body (dist seeds the real pack).
    test.use({ serviceWorkers: 'block' });

    test('pasaje citado sin versículos intermedios', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    // Freeze calendar day only; do not install fake timers (Angular HTTP/CD).
    await page.clock.setFixedTime(new Date(2026, 10, 17, 12, 0, 0));
    await page.addInitScript(() => {
      const spoken: string[] = [];
      (window as unknown as { __spoken: string[] }).__spoken = spoken;
      const synth = window.speechSynthesis;
      synth.cancel = () => undefined;
      synth.getVoices = () => [];
      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        spoken.push(utterance.text);
        utterance.onend?.(new Event('end') as SpeechSynthesisEvent);
      };
    });
    await page.route('**/bible-pueblo-de-dios-es/**', async (route) => {
      const url = route.request().url();
      if (url.includes('chunks.json') || url.includes('/c/')) {
        await route.fulfill({ status: 404, body: '' });
        return;
      }
      if (url.includes('index.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ indice: { a: [0] }, indice_por_punto: {} }),
        });
        return;
      }
      if (url.includes('content.json')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(BIBLE_FIXTURE),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/inicio');
    const first = page.locator('[data-lectura-id="first-0"]');
    await expect(first).toContainText('Ap 3,1-6.14-22', { timeout: 30_000 });
    await first.getByTestId('inicio-lectura-read').click();
    const pasaje = first.getByTestId('inicio-pasaje');
    await expect(pasaje).toBeVisible({ timeout: 30_000 });
    await expect(pasaje.getByTestId('pasaje-verse')).toHaveCount(4);
    await expect(pasaje.getByTestId('pasaje-span-gap')).toHaveCount(1);
    const numbers = await pasaje
      .getByTestId('pasaje-verse')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
    expect(numbers).toEqual(['1', '6', '14', '22']);
    await expect(pasaje).toContainText('Sardes');
    await expect(pasaje).toContainText('Laodicea');
    await expect(pasaje).not.toContainText('Filadelfia');
    await expect(pasaje).not.toContainText('sinagoga de Satanás');
    // Gap sits between the 1–6 span and the 14–22 span (before verse 14).
    const gapBefore = await pasaje.evaluate((root) => {
      const gap = root.querySelector('[data-testid="pasaje-span-gap"]');
      const verse14 = root.querySelector('[data-verse="14"]');
      return !!(gap && verse14 && gap.nextElementSibling === verse14);
    });
    expect(gapBefore).toBe(true);

    await first.getByTestId('inicio-lectura-listen').click();
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as unknown as { __spoken: string[] }).__spoken.join('\n'),
        ),
      )
      .toContain('Sardes');
    const spoken = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken.join('\n'),
    );
    expect(spoken).toContain('Laodicea');
    expect(spoken).not.toContain('Filadelfia');
    expect(spoken).not.toContain('sinagoga de Satanás');

    await page.goto('/lectio');
    const gospel = page.getByTestId('lectio-gospel-excerpt');
    await expect(gospel).toBeVisible({ timeout: 30_000 });
    const gospelNumbers = await gospel
      .getByTestId('pasaje-verse')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
    expect(gospelNumbers).toEqual(['1', '5', '10']);
    await expect(gospel).toContainText('Zaqueo');
    await expect(gospel).not.toContainText('fuera de la cita');
    await expect(page.getByTestId('lectio-more')).not.toHaveAttribute('open');
    await expect(page.getByRole('heading', { name: 'Los cinco pasos' })).toBeHidden();
    const verseBox = await gospel.getByTestId('pasaje-verse').first().boundingBox();
    const readBox = await page.getByTestId('lectio-gospel-read').boundingBox();
    expect(verseBox).toBeTruthy();
    expect(readBox).toBeTruthy();
    expect(verseBox!.y).toBeGreaterThanOrEqual(0);
    expect(readBox!.y + readBox!.height).toBeLessThanOrEqual(748);
    expect(verseBox!.y + verseBox!.height).toBeLessThanOrEqual(748);
    await page.getByTestId('lectio-gospel-read').click();
    await expect(page).toHaveURL(/\/lectio$/);
    await expect(page).not.toHaveURL(/\/leyendo/);
    await expect(gospel.getByTestId('pasaje-verse')).toHaveCount(3);

    await page.locator('[data-testid="lectio-reading"][data-cite="Ap 3,1-6.14-22"]').click();
    await expect(gospel.getByTestId('pasaje-verse')).toHaveCount(4);
    await expect(gospel.getByTestId('pasaje-span-gap')).toHaveCount(1);
    const lectioNumbers = await gospel
      .getByTestId('pasaje-verse')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
    expect(lectioNumbers).toEqual(['1', '6', '14', '22']);
    await expect(gospel).toContainText('Sardes');
    await expect(gospel).not.toContainText('Filadelfia');
    await expect(gospel).not.toContainText('sinagoga de Satanás');

    await page.getByTestId('lectio-gospel-listen').click();
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as unknown as { __spoken: string[] }).__spoken.at(-1) || '',
        ),
      )
      .toContain('Sardes');
    const gospelSpoken = await page.evaluate(
      () => (window as unknown as { __spoken: string[] }).__spoken.at(-1) || '',
    );
    expect(gospelSpoken).toContain('Laodicea');
    expect(gospelSpoken).not.toContain('Filadelfia');
    expect(gospelSpoken).not.toContain('sinagoga de Satanás');
    expect(gospelSpoken).not.toContain('Zaqueo');
    const inner = await page.evaluate(() => window.innerWidth);
    expect(inner).toBeLessThan(1024);
  });
  });

  test.describe('citas en carga fría', () => {
    test.use({ serviceWorkers: 'block' });

    test('lecturas y Agustín abren solo el texto citado', async ({ page }) => {
      test.setTimeout(90_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await page.clock.setFixedTime(new Date(2026, 10, 21, 12, 0, 0));

      let releaseBible: () => void = () => undefined;
      const bibleGate = new Promise<void>((resolve) => {
        releaseBible = resolve;
      });
      let releaseConf: () => void = () => undefined;
      const confGate = new Promise<void>((resolve) => {
        releaseConf = resolve;
      });
      let releaseTri: () => void = () => undefined;
      const triGate = new Promise<void>((resolve) => {
        releaseTri = resolve;
      });
      const bypasses: string[] = [];
      page.on('request', (req) => {
        const url = req.url();
        if (
          url.includes('bible-pueblo-de-dios-es') ||
          url.includes('npnf-agustin-')
        ) {
          const value = req.headers()['ngsw-bypass'];
          if (value) bypasses.push(value);
        }
      });

      const books: Record<string, Record<string, Record<string, number>>> = {
        apocalipsis: { '11': {} },
        'evangelio segun san lucas': { '20': {} },
      };
      const apUnits = [];
      const lcUnits = [];
      for (let verse = 4; verse <= 12; verse++) {
        const index = 35425 + (verse - 4);
        books.apocalipsis['11'][String(verse)] = index;
        apUnits.push(
          coldBibleUnit(
            index,
            'apocalipsis',
            11,
            verse,
            verse === 4 ? 'dos olivos ante el Señor' : `apocalipsis ${verse}`,
          ),
        );
      }
      for (let verse = 27; verse <= 40; verse++) {
        const index = 30357 + (verse - 27);
        books['evangelio segun san lucas']['20'][String(verse)] = index;
        lcUnits.push(
          coldBibleUnit(
            index,
            'evangelio segun san lucas',
            20,
            verse,
            verse === 27
              ? 'los saduceos niegan la resurrección'
              : `lucas ${verse}`,
          ),
        );
      }
      const citeMap = JSON.stringify({ v: 1, books });
      const npnf = (paragraph: string) =>
        JSON.stringify([
          { consecutivo: '0', contenido: 'Book 1.' },
          { consecutivo: '1', contenido: 'Chapter 1.' },
          { consecutivo: '2', contenido: paragraph },
        ]);

      await page.route(/bible-pueblo-de-dios-es\//, async (route) => {
        const url = route.request().url();
        if (url.includes('chunks.json')) {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ unitCount: 35652, chunkSize: 500 }),
          });
          return;
        }
        if (url.includes('cite-map.json')) {
          await route.fulfill({
            contentType: 'application/json',
            body: citeMap,
          });
          return;
        }
        if (url.includes('/c/')) {
          await bibleGate;
          const body = url.includes('/c/70.json')
            ? JSON.stringify(apUnits)
            : url.includes('/c/60.json')
              ? JSON.stringify(lcUnits)
              : '[]';
          await route.fulfill({ contentType: 'application/json', body });
          return;
        }
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: '',
        });
      });

      await page.route(/npnf-agustin-(?:confesiones|de-trinitate)-en\//, async (route) => {
        const url = route.request().url();
        if (url.includes('chunks.json') || url.includes('/c/')) {
          await route.fulfill({ status: 404, body: '' });
          return;
        }
        if (url.includes('index.json')) {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ indice: {}, indice_por_punto: {} }),
          });
          return;
        }
        if (!url.includes('content.json')) {
          await route.fulfill({ status: 404, body: '' });
          return;
        }
        const conf = url.includes('confesiones');
        await (conf ? confGate : triGate);
        await route.fulfill({
          contentType: 'application/json',
          body: npnf(
            conf
              ? '1. Great art Thou, and our heart is restless until it rests in thee.'
              : '1. The following dissertation concerning the Trinity opens the work.',
          ),
        });
      });

      try {
        await page.goto('/inicio');
        const ap = page.locator('[data-lectura-id="first-0"]');
        const lc = page.locator('[data-lectura-id="gospel-2"]');
        await expect(ap).toContainText('Ap 11,4-12', { timeout: 30_000 });
        await expect(lc).toContainText('Lc 20,27-40');

        const apChunk = page.waitForRequest(
          (req) =>
            req.url().includes('bible-pueblo-de-dios-es') &&
            req.url().includes('/c/70.json'),
        );
        await ap.getByTestId('inicio-lectura-read').click();
        await expect(ap.getByTestId('inicio-lectura-read')).toContainText(
          'Descargando',
        );
        await apChunk;
        await expect(ap.getByTestId('inicio-lectura-read')).toContainText(
          'Descargando',
        );
        expect(page.url()).toMatch(/\/inicio/);

        const lcChunk = page.waitForRequest(
          (req) =>
            req.url().includes('bible-pueblo-de-dios-es') &&
            req.url().includes('/c/60.json'),
        );
        await lc.getByTestId('inicio-lectura-read').click();
        await expect(lc.getByTestId('inicio-lectura-read')).toContainText(
          'Descargando',
        );
        await lcChunk;
        await expect(ap.getByTestId('inicio-lectura-read')).toContainText(
          'Descargando',
        );

        releaseBible();
        await expect(ap.getByTestId('inicio-pasaje')).toContainText(
          'dos olivos',
          { timeout: 15_000 },
        );
        await expect(lc.getByTestId('inicio-pasaje')).toContainText(
          'saduceos',
          { timeout: 15_000 },
        );
        await expect(ap.getByTestId('inicio-pasaje')).toBeVisible();
        await expect(lc.getByTestId('inicio-pasaje')).toBeVisible();
        await expect(ap.getByTestId('inicio-lectura-read')).toHaveText('Leer ›');
        expect(page.url()).toMatch(/\/inicio$/);
        expect(bypasses.length).toBeGreaterThan(0);
        expect(bypasses.every((value) => value === 'true')).toBe(true);

        await page.goto('/padres/agustin-hipona');
        await expect(page.getByTestId('quote-cite')).toHaveText(
          'Confesiones, I, 1',
          { timeout: 30_000 },
        );
        const confReq = page.waitForRequest(
          (req) =>
            req.url().includes('npnf-agustin-confesiones-en') &&
            req.url().includes('content.json'),
        );
        await page.getByTestId('quote-cite').click();
        await expect(page.getByTestId('padre-cite-progress')).toContainText(
          'Descargando',
        );
        await confReq;
        releaseConf();
        const pasaje = page.getByTestId('padre-pasaje');
        await expect(pasaje).toContainText('restless', { timeout: 15_000 });
        await expect(pasaje).toContainText('Great art Thou');
        expect(page.url()).toMatch(/\/padres\/agustin-hipona$/);

        const triReq = page.waitForRequest(
          (req) =>
            req.url().includes('npnf-agustin-de-trinitate-en') &&
            req.url().includes('content.json'),
        );
        await page
          .getByTestId('obra-cite')
          .filter({ hasText: 'De Trinitate' })
          .click();
        await expect(page.getByTestId('padre-cite-progress')).toContainText(
          'Descargando',
        );
        await triReq;
        releaseTri();
        await expect(pasaje).toContainText('following dissertation', {
          timeout: 15_000,
        });
        expect(page.url()).toMatch(/\/padres\/agustin-hipona$/);

        await page
          .getByTestId('obra-cite')
          .filter({ hasText: 'Confesiones' })
          .click();
        await expect(pasaje).toContainText('restless', { timeout: 15_000 });
        await expect(pasaje).not.toContainText('following dissertation');
        expect(page.url()).toMatch(/\/padres\/agustin-hipona$/);
        expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      } finally {
        releaseBible();
        releaseConf();
        releaseTri();
      }
    });

    test('domingo 34 en carga fría abre solo los versículos citados', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await page.addInitScript(() => {
        localStorage.setItem(
          'reader.prefs.v1',
          JSON.stringify({
            theme: 'mono',
            font: 'serif',
            fontSizePx: 18,
            lineHeight: 1.65,
            maxWidthCh: 65,
            keepAwake: false,
            contentLocale: 'en',
            uiLocale: 'en',
          }),
        );
      });
      await page.clock.setFixedTime(new Date(2026, 10, 22, 12, 0, 0));

      const books: Record<string, Record<string, Record<string, number>>> = {
        ezequiel: {
          '34': {
            '11': 13772,
            '12': 13773,
            '13': 13774,
            '14': 13775,
            '15': 13776,
            '16': 13777,
            '17': 13778,
          },
        },
        'evangelio segun san mateo': { '25': {} },
      };
      const ez: Record<number, unknown> = {
        13772: plainBibleUnit(13772, '11 I myself will look for my sheep'),
        13773: plainBibleUnit(13773, '12 like a shepherd among scattered sheep'),
        13774: plainBibleUnit(13774, '13 I will bring them out from the nations'),
        13775: plainBibleUnit(13775, '14 I will feed them in good pastures'),
        13776: plainBibleUnit(13776, '15 I myself will pasture my sheep'),
        13777: plainBibleUnit(13777, '16 I will seek the lost'),
        13778: plainBibleUnit(13778, '17 I will judge between sheep and sheep'),
      };
      const mt: Record<number, unknown> = {};
      for (let verse = 31; verse <= 46; verse++) {
        const index = 28592 + (verse - 31);
        books['evangelio segun san mateo']['25'][String(verse)] = index;
        mt[index] = coldBibleUnit(
          index,
          'evangelio segun san mateo',
          25,
          verse,
          verse === 31
            ? 'Cuando el Hijo del hombre venga en su gloria'
            : `mateo ${verse}`,
        );
      }
      const citeMap = JSON.stringify({ v: 1, books });
      const spec = JSON.stringify({ v: 1, unitCount: 35652, chunkSize: 500 });
      const bibleUrls: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('bible-pueblo-de-dios-')) bibleUrls.push(req.url());
      });

      await page.route(/bible-pueblo-de-dios-(?:en|es)\//, async (route) => {
        const url = route.request().url();
        const edition = url.includes('bible-pueblo-de-dios-en') ? 'en' : 'es';
        const json = (body: string) =>
          route.fulfill({ contentType: 'application/json', body });
        if (url.includes('chunks.json')) return json(spec);
        if (url.includes('cite-map.json')) {
          if (edition === 'en') return route.fulfill({ status: 404, body: '' });
          return json(citeMap);
        }
        if (url.includes('content.json') || url.includes('index.json')) {
          return route.fulfill({ status: 404, body: '' });
        }
        const chunk = url.match(/\/c\/(\d+)\.json/);
        if (!chunk) return route.fulfill({ status: 404, body: '' });
        const n = Number(chunk[1]);
        if (edition === 'en' && n === 27) return json(shipChunk(27, ez));
        if (edition === 'es' && n === 57) return json(shipChunk(57, mt));
        return route.fulfill({ status: 404, body: '' });
      });

      const manifest = page.waitForResponse(
        (res) => res.url().includes('/assets/corpus/manifest.json') && res.ok(),
      );
      await page.goto('/inicio');
      await manifest;
      const first = page.locator('[data-lectura-id="first-0"]');
      const gospel = page.locator('[data-lectura-id="gospel-3"]');
      await expect(first).toContainText('Ez 34,11-12.15-17', { timeout: 30_000 });
      await expect(gospel).toContainText('Mt 25,31-46');
      await expect(first.getByTestId('inicio-lectura-read')).toHaveText('Read ›');

      const started = Date.now();
      await first.getByTestId('inicio-lectura-read').click();
      const ezPasaje = first.getByTestId('inicio-pasaje');
      await expect(ezPasaje).toContainText('look for my sheep', { timeout: 3_000 });
      expect(Date.now() - started).toBeLessThan(3_000);
      await expect(ezPasaje).toContainText('pasture my sheep');
      await expect(ezPasaje).not.toContainText('from the nations');
      await expect(ezPasaje).not.toContainText('good pastures');
      const ezNumbers = await ezPasaje
        .getByTestId('pasaje-verse')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
      expect(ezNumbers).toEqual(['11', '12', '15', '16', '17']);
      await expect(first.getByTestId('inicio-lectura-read')).toHaveText('Read ›');
      expect(page.url()).toMatch(/\/inicio$/);
      expect(bibleUrls.some((url) => url.includes('content.json'))).toBe(false);
      expect(bibleUrls.some((url) => url.includes('/c/0.json'))).toBe(false);
      expect(
        bibleUrls.some((url) => url.includes('bible-pueblo-de-dios-en/c/27.json')),
      ).toBe(true);

      await gospel.getByTestId('inicio-lectura-read').click();
      const mtPasaje = gospel.getByTestId('inicio-pasaje');
      await expect(mtPasaje).toContainText('Hijo del hombre', { timeout: 3_000 });
      await expect(mtPasaje).not.toContainText('look for my sheep');
      expect(page.url()).toMatch(/\/inicio$/);
      expect(
        bibleUrls.some((url) => url.includes('bible-pueblo-de-dios-es/c/57.json')),
      ).toBe(true);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    });
  });

  test.describe('lectio pericopa', () => {
    test.use({ serviceWorkers: 'block' });

    test('perícopa citada completa en el primer viewport', async ({ page }) => {
      test.setTimeout(120_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await page.clock.setFixedTime(new Date(2026, 10, 17, 12, 0, 0));
      await page.addInitScript(() => {
        const spoken: string[] = [];
        (window as unknown as { __spoken: string[] }).__spoken = spoken;
        const synth = window.speechSynthesis;
        synth.cancel = () => undefined;
        synth.getVoices = () => [];
        synth.speak = (utterance: SpeechSynthesisUtterance) => {
          spoken.push(utterance.text);
          utterance.onend?.(new Event('end') as SpeechSynthesisEvent);
        };
      });

      await page.goto('/lectio');
      await expect(page.getByRole('heading', { name: 'Lectio divina' })).toBeVisible();
      const gospel = page.getByTestId('lectio-gospel-excerpt');
      await expect(gospel).toBeVisible({ timeout: 90_000 });
      const numbers = await gospel
        .getByTestId('pasaje-verse')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
      expect(numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
      await expect(gospel).toContainText('Jericó');
      await expect(gospel).toContainText('Zaqueo');
      await expect(gospel).toContainText('lo que estaba perdido');
      await expect(gospel).not.toContainText('iba a aparecer de un momento a otro');

      await expect(page.getByTestId('lectio-more')).not.toHaveAttribute('open');
      await expect(page.getByTestId('lectio-lit')).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Los cinco pasos' })).toBeHidden();

      const box = await gospel.getByTestId('pasaje-verse').first().boundingBox();
      const readBox = await page.getByTestId('lectio-gospel-read').boundingBox();
      expect(box).toBeTruthy();
      expect(readBox).toBeTruthy();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(readBox!.y + readBox!.height).toBeLessThanOrEqual(748);
      expect(box!.y + box!.height).toBeLessThanOrEqual(748);

      await page.getByTestId('lectio-gospel-read').click();
      await expect(page).toHaveURL(/\/lectio$/);
      await expect(page).not.toHaveURL(/\/leyendo|bible-pueblo/);
      await expect(gospel.getByTestId('pasaje-verse')).toHaveCount(10);

      await page.getByTestId('lectio-gospel-listen').click();
      await expect(page).toHaveURL(/\/lectio$/);
      await expect
        .poll(async () =>
          page.evaluate(
            () => (window as unknown as { __spoken: string[] }).__spoken.at(-1) || '',
          ),
        )
        .toContain('Zaqueo');
      const spoken = await page.evaluate(
        () => (window as unknown as { __spoken: string[] }).__spoken.at(-1) || '',
      );
      expect(spoken).toContain('Jericó');
      expect(spoken).toContain('lo que estaba perdido');
      expect(spoken).not.toContain('iba a aparecer de un momento a otro');
    });
  });

  test.describe('cita compartida', () => {
    test.use({ serviceWorkers: 'block' });

    test('cita bíblica desde doc abre la hoja citada', async ({ page }) => {
      test.setTimeout(120_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await stubOfflineBible(page);

      await page.goto('/leyendo/cic-es/punto/14');
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/14/, { timeout: 60_000 });
      await expect(page.locator('app-punto').first()).toBeVisible({ timeout: 60_000 });

      const cite = page.getByRole('link', { name: 'Ef 4, 13' }).first();
      await expect(cite).toBeVisible({ timeout: 30_000 });
      await cite.click();

      const sheet = page.getByRole('dialog', { name: 'Lectura rápida' });
      await expect(sheet).toBeVisible();
      await expectCitedText(sheet, 'hasta que todos lleguemos a la unidad de la fe');
      await expect(sheet.getByTestId('pasaje')).toBeVisible();
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/14/);
      await expect(page).not.toHaveURL(/bible-pueblo/);

      await pressBrowserBack(page);
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/14/);
    });

    test('cita bíblica discontinua en la hoja', async ({ page }) => {
      test.setTimeout(120_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await stubOfflineBible(page);

      await page.goto('/leyendo/cic-es/punto/51');
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/51/, { timeout: 60_000 });
      const cite = page.getByRole('link', { name: 'cf. St 2, 14-26' }).first();
      await expect(cite).toBeVisible({ timeout: 30_000 });
      await cite.click();

      const sheet = page.getByRole('dialog', { name: 'Lectura rápida' });
      await expect(sheet).toBeVisible();
      const body = sheet.getByTestId('cite-quick-body');
      await expectCitedText(sheet, 'santiago verso 14');
      await expect(body).toContainText('santiago verso 26');
      await expect(body).not.toContainText('santiago verso 27');
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/51/);

      await pressBrowserBack(page);
      await expect(sheet).toHaveCount(0);
    });

    test('cita doc-a-doc abre solo la unidad citada', async ({ page }) => {
      test.setTimeout(120_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
      await stubOfflineCt(page);

      await page.goto('/leyendo/cic-es/punto/79');
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/79/, { timeout: 60_000 });
      const cite = page.getByRole('link', { name: 'CT 18' }).first();
      await expect(cite).toBeVisible({ timeout: 30_000 });
      await cite.click();

      const sheet = page.getByRole('dialog', { name: 'Lectura rápida' });
      await expect(sheet).toBeVisible();
      await expectCitedText(sheet, 'catequesis no puede disociarse');
      await expect(sheet.getByTestId('cite-quick-body')).not.toContainText(
        'unidad fuera de la cita',
      );
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/79/);
      await expect(page).not.toHaveURL(/\/leyendo\/ct-es/);

      await pressBrowserBack(page);
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/79/);
    });

    test('cita CT 20-22; 25 trae el rango y el salto', async ({ page }) => {
      test.setTimeout(120_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

      await stubCanonicalDoc(page, 'ct-es');
      await page.goto('/leyendo/cic-es/punto/105');
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/105/, { timeout: 60_000 });
      const cite = page.getByRole('link', { name: /CT 20-22/ }).first();
      await expect(cite).toBeVisible({ timeout: 30_000 });
      await cite.click();

      const sheet = page.getByRole('dialog', { name: 'Lectura rápida' });
      await expect(sheet).toBeVisible();
      const body = sheet.getByTestId('cite-quick-body');
      await expectCitedText(sheet, 'finalidad específica de la catequesis');
      await expect(body).toContainText('discurso de clausura');
      await expect(body).toContainText('ortopraxis');
      await expect(body).toContainText('kerygma');
      await expect(body).not.toContainText('acción litúrgica');
      await expect(body).not.toContainText('acción responsable');
      const numbers = await body
        .getByTestId('pasaje-verse')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
      expect(numbers).toEqual(['20', '21', '22', '25']);
      await expect(body.getByTestId('pasaje-span-gap')).toHaveCount(1);
      const gapBefore25 = await body.evaluate((root) => {
        const gap = root.querySelector('[data-testid="pasaje-span-gap"]');
        const verse = root.querySelector('[data-verse="25"]');
        return !!(gap && verse && gap.nextElementSibling === verse);
      });
      expect(gapBefore25).toBe(true);
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/105/);
      await expect(page).not.toHaveURL(/\/leyendo\/ct-es/);

      await pressBrowserBack(page);
      await expect(sheet).toHaveCount(0);
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/105/);
    });

    test('cita GS 19-21 trae el rango continuo', async ({ page }) => {
      test.setTimeout(120_000);
      expect(page.viewportSize()).toEqual({ width: 390, height: 844 });

      await stubCanonicalDoc(page, 'gs-es');
      await page.goto('/leyendo/cic-es/punto/123');
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/123/, { timeout: 60_000 });
      const cite = page.getByRole('link', { name: /GS 19-21/ }).first();
      await expect(cite).toBeVisible({ timeout: 30_000 });
      await cite.click();

      const sheet = page.getByRole('dialog', { name: 'Lectura rápida' });
      await expect(sheet).toBeVisible();
      const body = sheet.getByTestId('cite-quick-body');
      await expectCitedText(sheet, 'unión con Dios');
      await expect(body).toContainText('ateísmo moderno');
      await expect(body).toContainText('no puede dejar de reprobar');
      await expect(body).not.toContainText('enigma de la vida');
      await expect(body).not.toContainText('Verbo encarnado');
      const numbers = await body
        .getByTestId('pasaje-verse')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
      expect(numbers).toEqual(['19', '20', '21']);
      await expect(body.getByTestId('pasaje-span-gap')).toHaveCount(0);
      await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/123/);
      await expect(page).not.toHaveURL(/\/leyendo\/gs-es/);

      await pressBrowserBack(page);
      await expect(sheet).toHaveCount(0);
    });
  });
  test('voz y velocidad siguen en la palabra', async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const voices = [
        {
          voiceURI: 'es-MX-mock-sabina',
          name: 'Sabina',
          lang: 'es-MX',
          localService: true,
          default: false,
        },
        {
          voiceURI: 'es-ES-mock-paulina',
          name: 'Paulina',
          lang: 'es-ES',
          localService: true,
          default: true,
        },
      ];
      class FakeUtterance {
        text: string;
        lang: string;
        rate: number;
        pitch: number;
        volume: number;
        voice: { voiceURI?: string } | null;
        onend: (() => void) | null;
        onerror: (() => void) | null;
        onboundary: ((ev: { charIndex: number; name: string }) => void) | null;
        constructor(text?: string) {
          this.text = text == null ? '' : String(text);
          this.lang = '';
          this.rate = 1;
          this.pitch = 1;
          this.volume = 1;
          this.voice = null;
          this.onend = null;
          this.onerror = null;
          this.onboundary = null;
        }
      }
      let current: FakeUtterance | null = null;
      let timer = 0;
      const synth = {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        pause() {
          synth.paused = true;
        },
        resume() {
          synth.paused = false;
        },
        cancel() {
          if (timer) clearInterval(timer);
          timer = 0;
          synth.speaking = false;
          synth.pending = false;
          current = null;
        },
        speak(u: FakeUtterance) {
          if (timer) clearInterval(timer);
          current = u;
          synth.speaking = true;
          const marks: number[] = [];
          const re = /\S+/g;
          let found: RegExpExecArray | null = re.exec(u.text);
          while (found) {
            marks.push(found.index);
            found = re.exec(u.text);
          }
          const rec = {
            text: u.text,
            rate: u.rate,
            lang: u.lang,
            voiceURI: (u.voice && u.voice.voiceURI) || '',
            maxChar: 0,
          };
          const host = window as unknown as { __dvUtterances?: typeof rec[] };
          const list = host.__dvUtterances || [];
          list.push(rec);
          host.__dvUtterances = list;
          let step = 0;
          timer = window.setInterval(() => {
            if (current !== u || step >= marks.length) return;
            const charIndex = marks[step] || 0;
            step += 1;
            rec.maxChar = charIndex;
            if (u.onboundary) u.onboundary({ charIndex, name: 'word' });
          }, 40);
        },
      };
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        writable: true,
        value: synth,
      });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        writable: true,
        value: FakeUtterance,
      });
    });

    await page.goto('/leyendo/cic-es/punto/2');
    await expect(page).toHaveURL(/\/leyendo\/cic-es\/u\/2/, { timeout: 60_000 });
    await expect(page.locator('app-lector')).toBeVisible({ timeout: 60_000 });
    await page.locator('[data-narr="play"]').click();
    await page.waitForFunction(
      () => {
        const list = (window as unknown as { __dvUtterances?: { maxChar: number }[] })
          .__dvUtterances;
        return !!list && list.length >= 1 && list[0].maxChar > 0;
      },
      undefined,
      { timeout: 15_000 },
    );

    await page.locator('.narr button.npill', { hasText: '×' }).click();
    await page.waitForFunction(
      () =>
        ((window as unknown as { __dvUtterances?: unknown[] }).__dvUtterances
          ?.length ?? 0) >= 2,
      undefined,
      { timeout: 15_000 },
    );

    const afterRate = await page.evaluate(() => {
      const list = (
        window as unknown as {
          __dvUtterances: { text: string; rate: number }[];
        }
      ).__dvUtterances;
      return [list[0], list[1]];
    });
    expect(afterRate[1].text.length).toBeGreaterThan(0);
    expect(afterRate[1].text.length).toBeLessThan(afterRate[0].text.length);
    expect(afterRate[0].text.endsWith(afterRate[1].text)).toBe(true);
    expect(afterRate[1].rate).toBeGreaterThan(afterRate[0].rate);

    await page.waitForFunction(
      () => {
        const list = (
          window as unknown as { __dvUtterances?: { maxChar: number }[] }
        ).__dvUtterances;
        return !!list && list.length >= 2 && list[1].maxChar > 0;
      },
      undefined,
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: /Cambiar voz/ }).click();
    await page.waitForFunction(
      () =>
        ((window as unknown as { __dvUtterances?: unknown[] }).__dvUtterances
          ?.length ?? 0) >= 3,
      undefined,
      { timeout: 15_000 },
    );
    const afterVoice = await page.evaluate(() => {
      const list = (
        window as unknown as {
          __dvUtterances: { text: string; lang: string; voiceURI: string }[];
        }
      ).__dvUtterances;
      return [list[1], list[2]];
    });
    expect(afterVoice[1].text.length).toBeGreaterThan(0);
    expect(afterVoice[1].text.length).toBeLessThan(afterVoice[0].text.length);
    expect(afterVoice[0].text.endsWith(afterVoice[1].text)).toBe(true);
    expect(afterVoice[1].voiceURI).toBe('es-MX-mock-sabina');
    expect(afterVoice[1].lang).toBe('es-MX');
    expect(afterVoice[0].lang).not.toBe(afterVoice[1].lang);
  });
});

/**
 * Cuerpo mínimo de la Biblia offline para la hoja de lectura rápida.
 * Solo por page.route: no tocar el dist (Sal 15 y otros workers leen el seed).
 */
async function expectCitedText(
  sheet: ReturnType<Page['getByRole']>,
  text: string,
): Promise<void> {
  const settled = sheet.locator(
    '[data-testid="cite-quick-body"], [data-testid="cite-quick-missing"]',
  );
  await expect(settled).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByTestId('cite-quick-missing')).toHaveCount(0);
  await expect(sheet.getByTestId('cite-quick-body')).toContainText(text);
}

async function stubOfflineBible(page: Page): Promise<void> {
  const units: unknown[] = Array.from({ length: 35652 }, () => ({
    contenido: '',
  }));
  const put = (
    index: number,
    book: string,
    chapter: number,
    verse: number,
    text: string,
  ) => {
    units[index] = {
      consecutivo: String(index),
      contenido: `${verse} ${text}`,
      biblia: {
        libro: book,
        capitulo: String(chapter),
        versiculo: verse,
        consecutivo_versiculo: `${book} ${chapter}, ${verse}`,
        index_general: String(index),
      },
    };
  };
  put(
    33833,
    'carta a los efesios',
    4,
    13,
    'hasta que todos lleguemos a la unidad de la fe',
  );
  for (let verse = 14; verse <= 26; verse++) {
    put(34841 + verse, 'carta de santiago', 2, verse, `santiago verso ${verse}`);
  }
  put(34841 + 27, 'carta de santiago', 2, 27, 'santiago verso 27');
  const body = JSON.stringify(units);
  const index = JSON.stringify({ indice: { a: [33833] }, indice_por_punto: {} });
  const chunks = JSON.stringify({ unitCount: 0, chunkSize: 0 });
  const books: Record<string, Record<string, Record<string, number>>> = {};
  for (let i = 0; i < units.length; i++) {
    const u = units[i] as {
      biblia?: { libro?: string; capitulo?: string; versiculo?: number };
    };
    const b = u.biblia;
    if (!b?.libro) continue;
    if (!books[b.libro]) books[b.libro] = {};
    if (!books[b.libro][String(b.capitulo)]) books[b.libro][String(b.capitulo)] = {};
    books[b.libro][String(b.capitulo)][String(b.versiculo)] = i;
  }
  const citeMap = JSON.stringify({ v: 1, books });
  await page.route(
    /bible-pueblo-de-dios-es\/(content|index|chunks|cite-map)\.json$/,
    (route) => {
      const url = route.request().url();
      const payload = url.includes('content.json')
        ? body
        : url.includes('cite-map.json')
          ? citeMap
          : url.includes('chunks.json')
            ? chunks
            : index;
      return route.fulfill({ contentType: 'application/json', body: payload });
    },
  );
}

/**
 * CI's mobile dist seeds cic-es, the bible and lg-es. Other packs 404.
 * Serve the canonical body (not a rewrite of the corpus) for this page only.
 */
async function stubCanonicalDoc(page: Page, id: string): Promise<void> {
  const dir = path.resolve(
    __dirname,
    '../../documentos/corpus/documents',
    id,
  );
  const body = fs.readFileSync(path.join(dir, 'content.json'), 'utf8');
  const index = fs.readFileSync(path.join(dir, 'index.json'), 'utf8');
  await page.route(new RegExp(`/${id}/(content|index|chunks)\\.json$`), (route) => {
    const url = route.request().url();
    if (url.includes('chunks.json')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ unitCount: 0, chunkSize: 0 }),
      });
    }
    const payload = url.includes('content.json') ? body : index;
    return route.fulfill({ contentType: 'application/json', body: payload });
  });
}

async function stubOfflineCt(page: Page): Promise<void> {
  const units = [
    { consecutivo: '17', contenido: '17 unidad fuera de la cita' },
    {
      consecutivo: '18',
      contenido:
        '18. La catequesis no puede disociarse del conjunto de actividades pastorales',
      index_array: 17,
    },
    { consecutivo: '19', contenido: '19 unidad fuera de la cita' },
  ];
  // Pack arrays are index-aligned: idPunto 17 → units[17].
  const packed: unknown[] = Array.from({ length: 20 }, (_, i) => ({
    consecutivo: String(i),
    contenido: `${i} unidad fuera de la cita`,
    index_array: i,
  }));
  packed[17] = units[1];
  const body = JSON.stringify(packed);
  const index = JSON.stringify({ indice: { a: [17] }, indice_por_punto: {} });
  await page.route(/\/ct-es\/(content|index|chunks)\.json$/, (route) => {
    const url = route.request().url();
    if (url.includes('chunks.json')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ unitCount: 0, chunkSize: 0 }),
      });
    }
    const payload = url.includes('content.json') ? body : index;
    return route.fulfill({ contentType: 'application/json', body: payload });
  });
}

/** Browser/Android back. Stays on this origin: the gesture must not unload the SPA. */
async function pressBrowserBack(page: Page): Promise<void> {
  const before = page.url();
  expect(before.startsWith('http')).toBe(true);
  await page.evaluate(() => history.back());
  await expect.poll(() => page.url(), { timeout: 20_000 }).not.toBe('about:blank');
  expect(new URL(page.url()).origin).toBe(new URL(before).origin);
}
