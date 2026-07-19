/**
 * Tests for ui-i18n.logic (shipped pure functions) + offline catalogs.
 * Run: node --experimental-strip-types src/app/core/i18n/ui-i18n.logic.test.js
 * From frontend/: node --experimental-strip-types src/app/core/i18n/ui-i18n.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'ui-i18n.logic.ts');
const I18N_DIR = path.resolve(HERE, '../../../assets/i18n');
const LOCALES = ['es', 'en', 'zh', 'hi', 'ar'];

function loadCatalogs() {
  /** @type {Record<string, Record<string, string>>} */
  const map = {};
  for (const loc of LOCALES) {
    const p = path.join(I18N_DIR, `${loc}.json`);
    assert.ok(fs.existsSync(p), `missing catalog ${p}`);
    map[loc] = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return map;
}

async function loadLogic() {
  return import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
}

async function main() {
  const L = await loadLogic();
  const catalogs = loadCatalogs();

  // resolveUiLocale
  assert.strictEqual(L.resolveUiLocale(undefined), 'es');
  assert.strictEqual(L.resolveUiLocale(null), 'es');
  assert.strictEqual(L.resolveUiLocale(''), 'es');
  assert.strictEqual(L.resolveUiLocale('es'), 'es');
  assert.strictEqual(L.resolveUiLocale('en-US'), 'en');
  assert.strictEqual(L.resolveUiLocale('zh_CN'), 'zh');
  assert.strictEqual(L.resolveUiLocale('hi'), 'hi');
  assert.strictEqual(L.resolveUiLocale('ar-SA'), 'ar');
  assert.strictEqual(L.resolveUiLocale('fr'), 'es'); // unsupported → fallback
  assert.strictEqual(L.resolveUiLocale('xx', 'en'), 'en');
  assert.strictEqual(L.isUiLocale('es'), true);
  assert.strictEqual(L.isUiLocale('pt'), false);

  // rtl
  assert.strictEqual(L.isRtl('ar'), true);
  assert.strictEqual(L.isRtl('ar-EG'), true);
  assert.strictEqual(L.isRtl('es'), false);
  assert.strictEqual(L.isRtl('en'), false);
  assert.strictEqual(L.dirForLocale('ar'), 'rtl');
  assert.strictEqual(L.dirForLocale('zh'), 'ltr');

  // applyDocumentLangDir
  const fake = { lang: '', dir: '', attrs: {}, setAttribute(n, v) { this.attrs[n] = v; } };
  L.applyDocumentLangDir(fake, 'ar');
  assert.strictEqual(fake.lang, 'ar');
  assert.strictEqual(fake.dir, 'rtl');
  assert.strictEqual(fake.attrs.lang, 'ar');
  assert.strictEqual(fake.attrs.dir, 'rtl');
  L.applyDocumentLangDir(fake, 'en');
  assert.strictEqual(fake.dir, 'ltr');
  L.applyDocumentLangDir(null, 'es'); // no throw

  // interpolate
  assert.strictEqual(L.interpolate('Hola {{name}}', { name: 'Ana' }), 'Hola Ana');
  assert.strictEqual(L.interpolate('v{{n}}', { n: 2 }), 'v2');
  assert.strictEqual(L.interpolate('x {{missing}} y', {}), 'x {{missing}} y');

  // t() sample keys for each language
  assert.strictEqual(L.t(catalogs, 'es', 'nav.home'), 'Inicio');
  assert.strictEqual(L.t(catalogs, 'en', 'nav.home'), 'Home');
  assert.strictEqual(L.t(catalogs, 'zh', 'nav.home'), '首页');
  assert.strictEqual(L.t(catalogs, 'hi', 'nav.home'), 'मुख्य');
  assert.strictEqual(L.t(catalogs, 'ar', 'nav.home'), 'الرئيسية');

  assert.strictEqual(L.t(catalogs, 'es', 'app.name'), 'Documentos Vaticanos');
  assert.strictEqual(L.t(catalogs, 'en', 'app.name'), 'Vatican Documents');
  assert.ok(L.t(catalogs, 'zh', 'app.name').length > 0);
  assert.ok(L.t(catalogs, 'hi', 'app.name').length > 0);
  assert.ok(L.t(catalogs, 'ar', 'app.name').length > 0);

  assert.strictEqual(L.t(catalogs, 'en', 'nav.library'), 'Library');
  assert.strictEqual(L.t(catalogs, 'en', 'settings.ui_language'), 'Interface language');
  assert.strictEqual(L.t(catalogs, 'es', 'inicio.saints_today'), 'Santos del día');
  assert.strictEqual(L.t(catalogs, 'ar', 'reader.index'), 'الفهرس');

  // fallback to es when key missing in zh
  const sparse = {
    es: { 'nav.home': 'Inicio', only_es: 'solo español' },
    zh: { 'nav.home': '首页' },
  };
  assert.strictEqual(L.t(sparse, 'zh', 'only_es'), 'solo español');
  assert.strictEqual(L.t(sparse, 'zh', 'nav.home'), '首页');
  // missing everywhere → key
  assert.strictEqual(L.t(sparse, 'zh', 'missing.key'), 'missing.key');
  assert.strictEqual(L.t(null, 'en', 'nav.home'), 'nav.home');

  // catalogs complete for required keys
  const required = [
    'nav.home',
    'nav.library',
    'nav.study',
    'nav.settings',
    'nav.account',
    'nav.parents',
    'nav.doctors',
    'nav.saints',
    'nav.themes',
    'nav.search_placeholder',
    'app.name',
    'common.loading',
    'common.back',
    'common.source',
    'common.continue',
    'common.save',
    'common.cancel',
    'common.error',
    'library.title',
    'library.all',
    'library.my_reading',
    'library.bookmarks',
    'settings.title',
    'settings.appearance',
    'settings.reading',
    'settings.ui_language',
    'settings.content_language',
    'settings.system',
    'settings.theme_mono',
    'settings.theme_claro',
    'settings.theme_sepia',
    'settings.theme_oscuro',
    'settings.theme_system',
    'settings.narrator',
    'reader.loading',
    'reader.start',
    'reader.language',
    'reader.markers',
    'reader.index',
    'account.title',
    'account.logout',
    'account.login',
    'inicio.lede',
    'inicio.start',
    'inicio.have_account',
    'inicio.saints_today',
  ];
  for (const loc of LOCALES) {
    for (const key of required) {
      const val = catalogs[loc][key];
      assert.ok(
        typeof val === 'string' && val.length > 0,
        `${loc}: missing or empty key ${key}`,
      );
      // no leftover raw keys as values (except intentional)
      assert.notStrictEqual(val, key, `${loc}: value is key leftover for ${key}`);
    }
  }

  // uiLocaleLabel native names
  assert.strictEqual(L.uiLocaleLabel('es'), 'Español');
  assert.strictEqual(L.uiLocaleLabel('en'), 'English');
  assert.strictEqual(L.uiLocaleLabel('zh'), '中文');
  assert.strictEqual(L.uiLocaleLabel('hi'), 'हिन्दी');
  assert.strictEqual(L.uiLocaleLabel('ar'), 'العربية');

  console.log('OK: ui-i18n.logic.test.js passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
