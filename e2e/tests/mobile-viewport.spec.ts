import { expect, test } from '@playwright/test';

/**
 * Phone layout smoke at 390×844 (project mobile-390).
 * Portada, lector, biblioteca, document cover (one header aligned with the meta card),
 * and offline reading history.
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
