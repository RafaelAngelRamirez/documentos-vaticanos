/**
 * Real unit tests for shipped misal-liturgia.logic.ts
 * Run: node --experimental-strip-types frontend/src/app/core/misal/misal-liturgia.logic.test.js
 *  or: node scripts-descarga/misal_liturgia_logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const LOGIC = path.join(__dirname, 'misal-liturgia.logic.ts');

async function main() {
  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);

  const sample = [
    {
      id: 'igmr-en',
      locale: 'en',
      unitCount: 399,
      title: 'General Instruction of the Roman Missal',
    },
    {
      id: 'igmr-es',
      locale: 'es',
      unitCount: 398,
      title: 'Instrucción general del Misal Romano',
    },
    {
      id: 'igmr-it',
      locale: 'it',
      unitCount: 397,
      title: 'Ordinamento Generale del Messale Romano',
    },
    {
      id: 'missale-romanum-apc-en',
      locale: 'en',
      unitCount: 17,
      title: 'Missale Romanum (Apostolic Constitution, 3 April 1969)',
    },
    {
      id: 'rm-es',
      locale: 'es',
      unitCount: 92,
      title: 'Redemptoris missio',
    },
    { id: 'cic-es', locale: 'es', unitCount: 5000, title: 'Catecismo' },
    { id: 'igmr-fr', locale: 'fr', unitCount: 0, title: 'empty shell' },
  ];

  assert.strictEqual(mod.isIgmrDocument({ id: 'igmr-es' }), true);
  assert.strictEqual(
    mod.isMissaleRomanumApcDocument({ id: 'missale-romanum-apc-en' }),
    true,
  );
  assert.strictEqual(
    mod.isMisalLiturgiaDocument({ id: 'rm-es' }),
    false,
    'rm-es is Redemptoris Missio, not Misal pack',
  );
  assert.strictEqual(mod.isMisalLiturgiaDocument({ id: 'cic-es' }), false);

  const listed = mod.listMisalLiturgiaDocuments(sample);
  assert.deepStrictEqual(
    listed.map((d) => d.id).sort(),
    ['igmr-en', 'igmr-es', 'igmr-it', 'missale-romanum-apc-en'].sort(),
    'lists only unitCount>0 misal packs',
  );

  const primaryEs = mod.pickPrimaryMisalEntry(sample, 'es');
  assert.strictEqual(primaryEs?.id, 'igmr-es');

  const primaryEn = mod.pickPrimaryMisalEntry(sample, 'en');
  assert.strictEqual(primaryEn?.id, 'igmr-en');

  const primaryHi = mod.pickPrimaryMisalEntry(sample, 'hi');
  assert.ok(primaryHi, 'fallback when product locale missing');
  assert.strictEqual(primaryHi.id, 'igmr-es', 'fallback prefers es');

  const secondary = mod.pickSecondaryMisalEntry(sample, 'es', primaryEs);
  assert.strictEqual(secondary?.id, 'missale-romanum-apc-en');

  const onlyApc = mod.pickPrimaryMisalEntry(
    [{ id: 'missale-romanum-apc-en', locale: 'en', unitCount: 5 }],
    'es',
  );
  assert.strictEqual(onlyApc?.id, 'missale-romanum-apc-en');

  assert.strictEqual(mod.pickPreferredMisalDoc([], 'es'), null);
  assert.ok(mod.misalBlockTitle().length > 3);
  assert.ok(/IGMR|Leer/i.test(mod.misalReadCtaLabel(primaryEs)));
  assert.ok(/Escuchar/.test(mod.misalListenCtaLabel()));

  console.log('ok misal-liturgia.logic');
  console.log(
    JSON.stringify({
      primaryEs: primaryEs?.id,
      primaryEn: primaryEn?.id,
      secondary: secondary?.id,
      listed: listed.length,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
