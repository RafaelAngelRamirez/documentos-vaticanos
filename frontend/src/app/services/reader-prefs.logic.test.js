/**
 * Size and mode clamps for reader.prefs.v1.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/services/reader-prefs.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'reader-prefs.logic.ts')).href
  );
  const {
    DEFAULT_READER_PREFERENCES,
    READER_PREFS_STORAGE_KEY,
    clampReaderPreferences,
    clampUiLocale,
    mergeReaderPreferences,
  } = mod;

  assert.strictEqual(READER_PREFS_STORAGE_KEY, 'reader.prefs.v1');

  const base = { ...DEFAULT_READER_PREFERENCES };
  const same = clampReaderPreferences(base);
  assert.strictEqual(same.fontSizePx, 18);
  assert.strictEqual(same.lineHeight, 1.65);
  assert.strictEqual(same.maxWidthCh, 65);
  assert.strictEqual(same.theme, 'mono');
  assert.strictEqual(same.font, 'serif');
  assert.strictEqual(same.keepAwake, false);

  const bounded = clampReaderPreferences({
    ...base,
    theme: 'paper',
    font: 'mono',
    fontSizePx: 99,
    lineHeight: 0.5,
    maxWidthCh: 10,
    keepAwake: 1,
    contentLocale: 'ES-MX',
    uiLocale: 'fr',
  });
  assert.strictEqual(bounded.theme, 'mono');
  assert.strictEqual(bounded.font, 'serif');
  assert.strictEqual(bounded.fontSizePx, 28);
  assert.strictEqual(bounded.lineHeight, 1.4);
  assert.strictEqual(bounded.maxWidthCh, 55);
  assert.strictEqual(bounded.keepAwake, false);
  assert.strictEqual(bounded.contentLocale, 'es');
  assert.strictEqual(bounded.uiLocale, 'es');

  const night = clampReaderPreferences({
    ...base,
    theme: 'night',
    font: 'sans',
    fontSizePx: 13.6,
    lineHeight: 2.4,
    maxWidthCh: 80.2,
    keepAwake: true,
    contentLocale: 'la',
    uiLocale: 'zh-CN',
  });
  assert.strictEqual(night.theme, 'oscuro');
  assert.strictEqual(night.font, 'sans');
  assert.strictEqual(night.fontSizePx, 14);
  assert.strictEqual(night.lineHeight, 2);
  assert.strictEqual(night.maxWidthCh, 80);
  assert.strictEqual(night.keepAwake, true);
  assert.strictEqual(night.contentLocale, 'la');
  assert.strictEqual(night.uiLocale, 'zh');

  const broken = clampReaderPreferences({
    ...base,
    theme: 'arcoiris',
    fontSizePx: Number.NaN,
    lineHeight: Number.POSITIVE_INFINITY,
    maxWidthCh: Number.NaN,
    contentLocale: '',
    uiLocale: 'en-US',
  });
  assert.strictEqual(broken.theme, 'mono');
  assert.strictEqual(broken.fontSizePx, 18);
  assert.strictEqual(broken.lineHeight, 1.65);
  assert.strictEqual(broken.maxWidthCh, 65);
  assert.strictEqual(broken.contentLocale, 'system');
  assert.strictEqual(broken.uiLocale, 'en');
  assert.strictEqual(clampUiLocale('HI'), 'hi');

  const merged = mergeReaderPreferences(base, {
    fontSizePx: 22,
    theme: 'sepia',
  });
  assert.strictEqual(merged.fontSizePx, 22);
  assert.strictEqual(merged.theme, 'sepia');
  assert.strictEqual(merged.font, 'serif');
  assert.strictEqual(merged.lineHeight, base.lineHeight);

  const nanMerged = mergeReaderPreferences(base, {
    fontSizePx: Number.NaN,
    maxWidthCh: Number.NaN,
  });
  assert.strictEqual(nanMerged.fontSizePx, 18);
  assert.strictEqual(nanMerged.maxWidthCh, 65);

  console.log('reader-prefs.logic: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
