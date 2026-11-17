import { expect, test } from '@playwright/test';

/**
 * Phone layout smoke at 390×844 (project mobile-390).
 * Portada, lector, biblioteca, document cover (one header aligned with the meta card),
 * offline reading history, and the cited-verse passage.
 */

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
    const numbers = await pasaje
      .getByTestId('pasaje-verse')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-verse')));
    expect(numbers).toEqual(['1', '6', '14', '22']);
    await expect(pasaje).toContainText('Sardes');
    await expect(pasaje).toContainText('Laodicea');
    await expect(pasaje).not.toContainText('Filadelfia');
    await expect(pasaje).not.toContainText('sinagoga de Satanás');

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

    await page.locator('[data-testid="lectio-reading"][data-cite="Ap 3,1-6.14-22"]').click();
    await expect(gospel.getByTestId('pasaje-verse')).toHaveCount(4);
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
});
