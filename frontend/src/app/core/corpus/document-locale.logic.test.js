/**
 * Tests for document-locale.logic (shipped pure functions).
 * Run: node --experimental-strip-types src/app/core/corpus/document-locale.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'document-locale.logic.ts');
const MANIFEST = path.resolve(
  HERE,
  '../../../../src/assets/corpus/manifest.json',
);

async function load() {
  return import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
}

function meta(id, locale, extra = {}) {
  return { id, locale, title: extra.title || id, unitCount: extra.unitCount ?? 10, ...extra };
}

async function main() {
  const L = await load();

  // familyKey
  assert.strictEqual(L.familyKey('nicea-i-es', 'es'), 'nicea-i');
  assert.strictEqual(L.familyKey('nicea-i-la', 'la'), 'nicea-i');
  assert.strictEqual(L.familyKey('constantinopla-i-es', 'es'), 'constantinopla-i');
  assert.strictEqual(L.familyKey('cceo-la', 'la'), 'cceo');
  assert.strictEqual(L.familyKey('cceo-es', 'es'), 'cceo');
  assert.strictEqual(L.familyKey('cic-es', 'es'), 'cic');
  assert.strictEqual(
    L.familyKey('bible-pueblo-de-dios-es', 'es'),
    'bible-pueblo-de-dios',
  );
  assert.strictEqual(L.familyKey('cceo-es'), 'cceo'); // suffix without locale arg
  assert.strictEqual(L.familyKey('weird-doc'), 'weird-doc');

  // familyKey: multi-locale + AI siblings
  assert.strictEqual(L.familyKey('lg-en', 'en'), 'lg');
  assert.strictEqual(L.familyKey('lg-en'), 'lg');
  assert.strictEqual(L.familyKey('lg-zh', 'zh'), 'lg');
  assert.strictEqual(L.familyKey('lg-en-ai', 'en'), 'lg');
  assert.strictEqual(L.familyKey('lg-en-ai'), 'lg');
  assert.strictEqual(L.familyKey('cceo-es-ai', 'es'), 'cceo');
  assert.strictEqual(L.familyKey('cceo-es-ai'), 'cceo');
  assert.strictEqual(L.familyKey('lg-hi-ai'), 'lg');
  assert.strictEqual(L.familyKey('lg-ar'), 'lg');

  // resolveContentLocale — device when pref is system / unset
  assert.strictEqual(L.resolveContentLocale('es', 'en-US'), 'es');
  assert.strictEqual(L.resolveContentLocale('system', 'es-MX'), 'es');
  assert.strictEqual(L.resolveContentLocale('system', 'en-US'), 'en');
  assert.strictEqual(L.resolveContentLocale('system', 'zh-CN'), 'zh');
  assert.strictEqual(L.resolveContentLocale('system', 'hi-IN'), 'hi');
  assert.strictEqual(L.resolveContentLocale('system', 'ar-SA'), 'ar');
  assert.strictEqual(L.resolveContentLocale(undefined, 'la'), 'la');
  assert.strictEqual(L.resolveContentLocale(null, 'en-GB'), 'en');
  assert.strictEqual(L.resolveContentLocale('system', null, 'es'), 'es');
  assert.strictEqual(L.resolveContentLocale('system', '', 'es'), 'es');
  assert.strictEqual(L.normalizeLocaleCode('pt-BR'), 'pt');
  assert.strictEqual(L.normalizeLocaleCode('es-MX'), 'es');

  // pickPreferredEdition
  const cceo = [
    meta('cceo-la', 'la', { unitCount: 1514 }),
    meta('cceo-es', 'es', { unitCount: 1514 }),
  ];
  assert.strictEqual(L.pickPreferredEdition(cceo, 'es').id, 'cceo-es');
  assert.strictEqual(L.pickPreferredEdition(cceo, 'la').id, 'cceo-la');
  assert.strictEqual(L.pickPreferredEdition(cceo, 'en').id, 'cceo-es'); // fallback es
  assert.strictEqual(L.pickPreferredEdition([meta('cic-es', 'es')], 'la').id, 'cic-es');

  // pickPreferredEdition prefers en when available
  const lgPack = [
    meta('lg-es', 'es'),
    meta('lg-en', 'en'),
    meta('lg-la', 'la'),
  ];
  assert.strictEqual(L.pickPreferredEdition(lgPack, 'en').id, 'lg-en');
  assert.strictEqual(L.pickPreferredEdition(lgPack, 'es').id, 'lg-es');
  // prefer official over AI when same locale
  const lgWithAi = [
    meta('lg-en-ai', 'en', { translationProvenance: 'ai' }),
    meta('lg-en', 'en'),
    meta('lg-es', 'es'),
  ];
  assert.strictEqual(L.pickPreferredEdition(lgWithAi, 'en').id, 'lg-en');

  // group + listPreferred
  const pack = [
    meta('nicea-i-la', 'la', { title: 'Nicea LA' }),
    meta('nicea-i-es', 'es', { title: 'Nicea ES' }),
    meta('cic-es', 'es', { title: 'CIC' }),
    meta('cceo-la', 'la'),
    meta('cceo-es', 'es'),
  ];
  const prefEs = L.listPreferredEditions(pack, 'es');
  assert.strictEqual(prefEs.length, 3, '3 families for es pref');
  assert.ok(prefEs.some((d) => d.id === 'nicea-i-es'));
  assert.ok(prefEs.some((d) => d.id === 'cceo-es'));
  assert.ok(prefEs.some((d) => d.id === 'cic-es'));
  assert.ok(!prefEs.some((d) => d.id.endsWith('-la')));

  const prefLa = L.listPreferredEditions(pack, 'la');
  assert.ok(prefLa.some((d) => d.id === 'nicea-i-la'));
  assert.ok(prefLa.some((d) => d.id === 'cceo-la'));
  assert.ok(prefLa.some((d) => d.id === 'cic-es')); // only es edition

  // editionsForDocument groups AI siblings with family
  const packAi = [
    meta('lg-es', 'es'),
    meta('lg-en', 'en'),
    meta('lg-en-ai', 'en', { translationProvenance: 'ai' }),
  ];
  const edsLg = L.editionsForDocument(packAi, 'lg-en-ai');
  assert.strictEqual(edsLg.length, 3);
  assert.ok(edsLg.every((e) => L.familyKey(e.id, e.locale) === 'lg'));

  // editionsForDocument
  const eds = L.editionsForDocument(pack, 'cceo-es');
  assert.strictEqual(eds.length, 2);
  assert.deepStrictEqual(
    eds.map((e) => e.id).sort(),
    ['cceo-es', 'cceo-la'].sort(),
  );

  // mapUnitIndexOnLocaleSwitch
  assert.strictEqual(L.mapUnitIndexOnLocaleSwitch(42, 1514, 1514), 42);
  assert.strictEqual(L.mapUnitIndexOnLocaleSwitch(42, 100, 50), 0);
  assert.strictEqual(L.mapUnitIndexOnLocaleSwitch(5, null, 10), 0);

  // labels
  assert.strictEqual(L.localeLabel('es'), 'Español');
  assert.strictEqual(L.localeLabel('la'), 'Latina');
  assert.strictEqual(L.localeLabel('zh'), '中文');
  assert.strictEqual(L.localeLabel('hi'), 'हिन्दी');
  assert.strictEqual(L.localeLabel('ar'), 'العربية');
  assert.strictEqual(L.localeBadge('es'), 'ES');
  assert.strictEqual(L.localeBadge('zh'), 'ZH');
  assert.ok(L.multiLocaleSubtitle(cceo)?.includes('Español'));
  assert.strictEqual(L.multiLocaleSubtitle([meta('cic-es', 'es')]), null);

  // isAiEdition
  assert.strictEqual(L.isAiEdition(meta('lg-en-ai', 'en')), true);
  assert.strictEqual(L.isAiEdition(meta('cceo-es-ai', 'es')), true);
  assert.strictEqual(
    L.isAiEdition(meta('lg-en', 'en', { translationProvenance: 'ai' })),
    true,
  );
  assert.strictEqual(
    L.isAiEdition(
      meta('foo-es', 'es', {
        sourceNote: 'Traducción generada por IA a partir del latín.',
      }),
    ),
    true,
  );
  assert.strictEqual(
    L.isAiEdition(
      meta('foo-en', 'en', { sourceNote: 'AI translation for study only.' }),
    ),
    true,
  );
  assert.strictEqual(L.isAiEdition(meta('lg-en', 'en')), false);
  assert.strictEqual(
    L.isAiEdition(meta('cic-es', 'es', { translationProvenance: 'official' })),
    false,
  );

  // localeProvenanceBadge
  assert.strictEqual(L.localeProvenanceBadge('es', false), 'ES');
  assert.strictEqual(L.localeProvenanceBadge('es', true), 'ES(IA)');
  assert.strictEqual(L.localeProvenanceBadge('en', false), 'EN');
  assert.strictEqual(L.localeProvenanceBadge('en', true), 'EN(AI)');
  assert.strictEqual(L.localeProvenanceBadge('zh', false), '中文');
  assert.strictEqual(L.localeProvenanceBadge('zh', true), '中文(AI)');
  assert.strictEqual(L.localeProvenanceBadge('hi', true), 'हिन्दी(AI)');
  assert.strictEqual(L.localeProvenanceBadge('ar', true), 'عربية(AI)');
  assert.strictEqual(L.localeBadge('es', true), 'ES(IA)');
  assert.strictEqual(L.localeBadge('en', true), 'EN(AI)');

  // multiLocaleSubtitle with AI provenance badges
  const multiAi = [
    meta('lg-es', 'es'),
    meta('lg-en-ai', 'en', { translationProvenance: 'ai' }),
  ];
  const subAi = L.multiLocaleSubtitle(multiAi);
  assert.ok(subAi?.includes('Español'), subAi);
  assert.ok(subAi?.includes('EN(AI)'), subAi);

  // aiSourceNote
  const noteEs = L.aiSourceNote('es', 'Lumen gentium', 'lg-la', 'Latina');
  assert.ok(/IA|inteligencia/i.test(noteEs) || /generada por IA/i.test(noteEs), noteEs);
  assert.ok(/Santa Sede|oficial/i.test(noteEs), noteEs);
  assert.ok(/estudio/i.test(noteEs), noteEs);
  assert.ok(noteEs.includes('Lumen gentium'));
  assert.ok(noteEs.includes('lg-la'));

  const noteEn = L.aiSourceNote('en', 'Lumen gentium', 'lg-la', 'Latin');
  assert.ok(/AI|generated/i.test(noteEn), noteEn);
  assert.ok(/Holy See|official/i.test(noteEn), noteEn);
  assert.ok(/study/i.test(noteEn), noteEn);

  const noteZh = L.aiSourceNote('zh', 'Lumen gentium', 'lg-la', '拉丁语');
  assert.ok(/人工智能|翻译/.test(noteZh), noteZh);

  const noteHi = L.aiSourceNote('hi', 'Lumen gentium', 'lg-la', 'लैटिन');
  assert.ok(/AI|अनुवाद|अध्ययन/.test(noteHi), noteHi);

  const noteAr = L.aiSourceNote('ar', 'Lumen gentium', 'lg-la', 'اللاتينية');
  assert.ok(/ذكاء|ترجمة|دراسة/.test(noteAr), noteAr);

  // APP_UI_LOCALES / CONTENT_LOCALES exports
  assert.ok(Array.isArray(L.APP_UI_LOCALES));
  assert.deepStrictEqual([...L.APP_UI_LOCALES], ['es', 'en', 'zh', 'hi', 'ar']);
  assert.ok(L.CONTENT_LOCALES.includes('la'));
  assert.ok(L.CONTENT_LOCALES.includes('zh'));
  assert.ok(L.KNOWN_LOCALE_SUFFIXES.includes('zh'));
  assert.ok(L.KNOWN_LOCALE_SUFFIXES.includes('hi'));
  assert.ok(L.KNOWN_LOCALE_SUFFIXES.includes('ar'));

  // Real manifest collapse smoke
  if (fs.existsSync(MANIFEST)) {
    const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const metas = man.documents || [];
    const all = metas.length;
    const collapsed = L.listPreferredEditions(metas, 'es');
    assert.ok(all > collapsed.length, `collapse ${all} → ${collapsed.length}`);
    const laIds = metas.filter((d) => d.locale === 'la' || d.id.endsWith('-la'));
    assert.ok(laIds.length >= 20, 'has latin packs');
    // every LA family has preferred es when twin exists
    for (const la of laIds) {
      const fam = L.editionsForDocument(metas, la.id);
      if (fam.some((e) => (e.locale || '').startsWith('es') || e.id.endsWith('-es'))) {
        const pick = L.pickPreferredEdition(fam, 'es');
        assert.ok(
          pick.locale === 'es' || pick.id.endsWith('-es') || pick.id.includes('-es-'),
          `preferred es for ${la.id} → ${pick.id}`,
        );
      }
    }
    console.log(`OK: manifest collapse ${all} → ${collapsed.length} (pref=es)`);
  }

  console.log('OK: document-locale.logic.test.js passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
