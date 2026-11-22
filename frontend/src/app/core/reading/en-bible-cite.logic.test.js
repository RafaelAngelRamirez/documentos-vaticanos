/**
 * English bible footnotes with no stored destination.
 * Gaudete et exsultate (en) stores `Mt 5:12` and `Gen 17:1` without `local`.
 * The Spanish twin of the same paragraph points at the verse.
 * The English bible has the same unit index and no `biblia` / cite-map.
 *
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/reading/en-bible-cite.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const corpus = path.resolve(__dirname, '../../../../../documentos/corpus/documents');

function load(id) {
  return JSON.parse(fs.readFileSync(path.join(corpus, id, 'content.json'), 'utf8'));
}

async function main() {
  const cite = await import(
    pathToFileURL(
      path.join(__dirname, '../liturgia/bible-cite.logic.ts'),
    ).href
  );
  const mapMod = await import(
    pathToFileURL(path.join(__dirname, '../liturgia/cite-map.logic.ts')).href
  );
  const resolve = await import(
    pathToFileURL(path.join(__dirname, 'resolve-cited-passage.logic.ts')).href
  );

  const mt = cite.parseBibleCites('Mt 5:12');
  assert.ok(mt, 'Mt 5:12 is a bible cite');
  assert.strictEqual(mt.length, 1);
  assert.strictEqual(mt[0].code, 'Mt');
  assert.strictEqual(mt[0].spans[0].chapter, 5);
  assert.strictEqual(mt[0].spans[0].start, 12);
  assert.strictEqual(mt[0].spans[0].end, 12);

  const gn = cite.parseBibleCites('Gen 17:1');
  assert.ok(gn, 'Gen 17:1 is Genesis 17:1');
  assert.strictEqual(gn[0].code, 'Gn');
  assert.strictEqual(gn[0].spans[0].chapter, 17);
  assert.strictEqual(gn[0].spans[0].start, 1);

  assert.strictEqual(cite.parseBibleCites('12:1'), null);
  assert.strictEqual(
    cite.parseBibleCites('S. Agustín, De Trinitate, 15,26,47'),
    null,
  );

  const esSpan = cite.parseBibleCites('Mt 5,12');
  assert.ok(esSpan);
  assert.strictEqual(esSpan[0].code, 'Mt');
  assert.strictEqual(esSpan[0].spans[0].start, 12);
  const esGn = cite.parseBibleCites('Gn 17,1');
  assert.ok(esGn);
  assert.strictEqual(esGn[0].code, 'Gn');

  assert.strictEqual(cite.biblePackIdForLocale('en'), 'bible-pueblo-de-dios-en');
  assert.strictEqual(cite.biblePackIdForLocale('en-US'), 'bible-pueblo-de-dios-en');
  assert.strictEqual(cite.biblePackIdForLocale('es'), 'bible-pueblo-de-dios-es');

  const gaudeteEn = load('esortazione-ap-20180319-gaudete-et-exsultate-en');
  const gaudeteEs = load('esortazione-ap-20180319-gaudete-et-exsultate-es');
  const enRefs = gaudeteEn[0].referencias;
  const esRefs = gaudeteEs[0].referencias;
  assert.strictEqual(enRefs[0].descripcion, 'Mt 5:12');
  assert.strictEqual(enRefs[1].descripcion, 'Gen 17:1');
  assert.ok(!enRefs[0].local, 'EN Mt 5:12 has no offline destination');
  assert.ok(!enRefs[1].local, 'EN Gen 17:1 has no offline destination');
  assert.strictEqual(esRefs[0].descripcion, 'Mt 5,12');
  assert.strictEqual(esRefs[1].descripcion, 'Gn 17,1');
  assert.strictEqual(esRefs[0].local.idDocumento, 'bible-pueblo-de-dios-es');
  assert.strictEqual(esRefs[1].local.idDocumento, 'bible-pueblo-de-dios-es');

  const esBible = load('bible-pueblo-de-dios-es');
  const enBible = load('bible-pueblo-de-dios-en');
  assert.ok(!enBible[399].biblia, 'English bible units carry no biblia mark');
  assert.ok(esBible[399].biblia);
  const map = mapMod.buildBibleCiteMap(esBible);
  assert.ok(map);

  let stamped = enBible;
  for (const passage of [mt[0], gn[0]]) {
    stamped = mapMod.addressUnitsFromCiteMap(stamped, map, passage);
  }
  const mtShown = resolve.resolveCitedPassageFromCite(
    'bible-pueblo-de-dios-en',
    'Mt 5:12',
    stamped,
  );
  assert.ok(mtShown);
  assert.deepStrictEqual(
    mtShown.verses.map((v) => v.verse),
    [12],
  );
  assert.strictEqual(mtShown.verses[0].chapter, 5);
  assert.ok(mtShown.verses[0].text.includes('Rejoice and be glad'));
  assert.strictEqual(String(mtShown.verses[0].index), String(esRefs[0].local.idPunto));

  // Stale/wrong versiculo on a unit that already has biblia.libro must not
  // paint «32» when the reader tapped Mt 5:12 (Rafa v0.0.70).
  const mtIdx = Number(esRefs[0].local.idPunto);
  const corrupt = enBible.slice();
  corrupt[mtIdx] = {
    ...enBible[mtIdx],
    biblia: {
      libro: 'evangelio segun san mateo',
      capitulo: '5',
      versiculo: 32,
      consecutivo_versiculo: 'Mt 5, 32',
      index_general: String(mtIdx),
    },
  };
  const restamped = mapMod.addressUnitsFromCiteMap(corrupt, map, mt[0]);
  assert.strictEqual(restamped[mtIdx].biblia.versiculo, 12);
  const fixed = resolve.resolveCitedPassageFromCite(
    'bible-pueblo-de-dios-en',
    'Mt 5:12',
    restamped,
  );
  assert.ok(fixed);
  assert.deepStrictEqual(
    fixed.verses.map((v) => v.verse),
    [12],
  );
  assert.ok(fixed.verses[0].text.includes('Rejoice and be glad'));
  assert.ok(!fixed.verses[0].text.startsWith('12'));

  const fromLocal = resolve.resolveCitedPassageFromLocalRef(
    'bible-pueblo-de-dios-en',
    mtIdx,
    'Mt 5:12',
    corrupt,
  );
  assert.ok(fromLocal);
  assert.strictEqual(fromLocal.verses[0].verse, 12);
  assert.ok(fromLocal.verses[0].text.includes('Rejoice and be glad'));

  const gnShown = resolve.resolveCitedPassageFromCite(
    'bible-pueblo-de-dios-en',
    'Gen 17:1',
    stamped,
  );
  assert.ok(gnShown);
  assert.deepStrictEqual(
    gnShown.verses.map((v) => `${v.chapter}:${v.verse}`),
    ['17:1'],
  );
  assert.ok(gnShown.verses[0].text.includes('Almighty God'));
  assert.ok(!gnShown.verses[0].text.includes('covenant'));
  assert.strictEqual(String(gnShown.verses[0].index), String(esRefs[1].local.idPunto));

  const esMt = resolve.resolveCitedPassageFromCite(
    'bible-pueblo-de-dios-es',
    'Mt 5,12',
    esBible,
  );
  assert.ok(esMt);
  assert.ok(esMt.verses[0].text.includes('Alégrense'));
  assert.strictEqual(String(esMt.verses[0].index), String(esRefs[0].local.idPunto));
  const esGnShown = resolve.resolveCitedPassageFromCite(
    'bible-pueblo-de-dios-es',
    'Gn 17,1',
    esBible,
  );
  assert.ok(esGnShown);
  assert.ok(esGnShown.verses[0].text.includes('Todopoderoso'));
  assert.strictEqual(String(esGnShown.verses[0].index), String(esRefs[1].local.idPunto));
  assert.strictEqual(esMt.verses.length, 1);
  assert.strictEqual(esGnShown.verses.length, 1);

  const chain = cite.parseBibleCites('cf. Mt 5:3-12; Lk 6:20-23');
  assert.ok(chain);
  assert.strictEqual(chain.length, 2);
  assert.strictEqual(chain[0].code, 'Mt');
  assert.strictEqual(chain[1].code, 'Lc');

  const puntoHtml = fs.readFileSync(
    path.join(__dirname, '../../components/punto/punto/punto.component.html'),
    'utf8',
  );
  const puntoTs = fs.readFileSync(
    path.join(__dirname, '../../components/punto/punto/punto.component.ts'),
    'utf8',
  );
  const lector = fs.readFileSync(
    path.join(__dirname, '../../components/lector/lector.component.ts'),
    'utf8',
  );
  assert.ok(puntoHtml.includes('seg.bible'));
  assert.ok(puntoHtml.includes("data-testid") && puntoHtml.includes('bible-cite'));
  assert.ok(puntoHtml.includes('!seg.bible'));
  assert.ok(puntoTs.includes('parseBibleCites'));
  assert.ok(lector.includes('biblePackIdForLocale'));
  assert.ok(lector.includes('resolveCitedPassageFromCite'));

  console.log('ok en-bible-cite');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
