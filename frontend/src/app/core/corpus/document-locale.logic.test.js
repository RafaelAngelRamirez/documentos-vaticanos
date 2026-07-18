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

  // resolveContentLocale
  assert.strictEqual(L.resolveContentLocale('es', 'en-US'), 'es');
  assert.strictEqual(L.resolveContentLocale('system', 'es-MX'), 'es');
  assert.strictEqual(L.resolveContentLocale(undefined, 'la'), 'la');
  assert.strictEqual(L.resolveContentLocale('system', null, 'es'), 'es');
  assert.strictEqual(L.normalizeLocaleCode('pt-BR'), 'pt');

  // pickPreferredEdition
  const cceo = [
    meta('cceo-la', 'la', { unitCount: 1514 }),
    meta('cceo-es', 'es', { unitCount: 1514 }),
  ];
  assert.strictEqual(L.pickPreferredEdition(cceo, 'es').id, 'cceo-es');
  assert.strictEqual(L.pickPreferredEdition(cceo, 'la').id, 'cceo-la');
  assert.strictEqual(L.pickPreferredEdition(cceo, 'en').id, 'cceo-es'); // fallback es
  assert.strictEqual(L.pickPreferredEdition([meta('cic-es', 'es')], 'la').id, 'cic-es');

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
  assert.strictEqual(L.localeBadge('es'), 'ES');
  assert.ok(L.multiLocaleSubtitle(cceo)?.includes('Español'));
  assert.strictEqual(L.multiLocaleSubtitle([meta('cic-es', 'es')]), null);

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
          pick.locale === 'es' || pick.id.endsWith('-es'),
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
