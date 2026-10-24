/**
 * Structural wiring: Ajustes UI locale vs content locale pickers.
 * Run: node src/app/pages/ajustes/ajustes_locale_ui.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FE = path.resolve(__dirname, '../..');

function read(rel) {
  const p = path.join(FE, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function main() {
  const html = read('pages/ajustes/ajustes.component.html');
  const ts = read('pages/ajustes/ajustes.component.ts');
  const i18n = read('core/i18n/ui-i18n.service.ts');
  const prefs = read('services/reader-preferences.service.ts');

  assert.ok(
    /data-testid=["']ajustes-ui-locale["']/.test(html),
    'UI locale group has data-testid',
  );
  assert.ok(
    /data-testid=["']ajustes-content-locale["']/.test(html),
    'content locale group has data-testid',
  );
  assert.ok(
    /settings\.ui_language/.test(html) && /settings\.content_language/.test(html),
    'both locale section keys present',
  );

  assert.ok(/setUiLocale\(/.test(ts), 'component has setUiLocale');
  assert.ok(/setContentLocale\(/.test(ts), 'component has setContentLocale');
  assert.ok(
    /this\.i18n\.setLocale\(locale\)/.test(ts),
    'UI picker persists via UiI18nService.setLocale',
  );
  assert.ok(
    /this\.readerPrefs\.setContentLocale\(locale\)/.test(ts),
    'content picker persists via ReaderPreferencesService.setContentLocale',
  );

  // Independent: UI handler must not write contentLocale; content handler must not write uiLocale.
  const uiFn = ts.match(
    /setUiLocale\([^)]*\)\s*:\s*void\s*\{[\s\S]*?\n  \}/,
  );
  assert.ok(uiFn, 'setUiLocale method body');
  assert.ok(
    !/setContentLocale/.test(uiFn[0]),
    'setUiLocale must not persist contentLocale',
  );
  const contentFn = ts.match(
    /setContentLocale\([^)]*\)\s*:\s*void\s*\{[\s\S]*?\n  \}/,
  );
  assert.ok(contentFn, 'setContentLocale method body');
  assert.ok(
    !/setUiLocale/.test(contentFn[0]) && !/i18n\.setLocale/.test(contentFn[0]),
    'setContentLocale must not persist uiLocale',
  );

  assert.ok(
    /setLocale\([^)]*\)\s*:\s*void[\s\S]*?readerPrefs\.setUiLocale/.test(i18n),
    'UiI18nService.setLocale writes uiLocale',
  );
  assert.ok(
    /setContentLocale\(contentLocale/.test(prefs),
    'ReaderPreferencesService.setContentLocale shipped',
  );
  assert.ok(
    /setUiLocale\(uiLocale/.test(prefs),
    'ReaderPreferencesService.setUiLocale shipped',
  );
  assert.ok(
    /localePrefsFromStorage/.test(prefs),
    'prefs load uses localePrefsFromStorage (device vs override)',
  );

  console.log('ok ajustes-locale-ui');
}

main();
