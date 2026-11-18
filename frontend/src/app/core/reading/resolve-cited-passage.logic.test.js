/**
 * Shared cited-passage resolver (day reading + cross-refs).
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/reading/resolve-cited-passage.logic.test.js
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

function unit(index, book, chapter, verse, text, extra = {}) {
  return {
    index_array: index,
    contenido: text,
    consecutivo: extra.consecutivo,
    biblia: book
      ? { libro: book, capitulo: String(chapter), versiculo: verse }
      : undefined,
  };
}

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'resolve-cited-passage.logic.ts')).href
  );
  const biblePath = path.resolve(
    __dirname,
    '../../../../../documentos/corpus/documents/bible-pueblo-de-dios-es/content.json',
  );
  const bible = JSON.parse(fs.readFileSync(biblePath, 'utf8'));

  assert.strictEqual(mod.isOfflineBibleId('bible-pueblo-de-dios-es'), true);
  assert.strictEqual(mod.isOfflineBibleId('cic-es'), false);
  assert.strictEqual(mod.stripCitePrefix('cf. St 2, 14-26'), 'St 2, 14-26');

  // Day reading / lectionary discontinuous.
  const day = mod.resolveCitedPassageFromCite(
    'bible-pueblo-de-dios-es',
    'Ap 3,1-6.14-22',
    bible,
  );
  assert.ok(day);
  assert.deepStrictEqual(
    day.verses.map((v) => v.verse),
    [1, 2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  );
  assert.strictEqual(day.verses.find((v) => v.verse === 14).spanBreakBefore, true);
  assert.ok(!day.verses.some((v) => v.verse === 7));
  assert.ok(day.speechText.includes('Sardes'));
  assert.ok(!/Filadelfia/.test(day.speechText));

  // Bible cite from a document (label with cf. + continuous range).
  const james = [];
  for (let verse = 14; verse <= 27; verse++) {
    james.push(
      unit(
        34841 + verse,
        'carta de santiago',
        2,
        verse,
        `${verse} texto del versículo ${verse}`,
      ),
    );
  }
  const fromDoc = mod.resolveCitedPassageFromLocalRef(
    'bible-pueblo-de-dios-es',
    34855,
    'cf. St 2, 14-26',
    james,
  );
  assert.ok(fromDoc);
  assert.deepStrictEqual(
    fromDoc.verses.map((v) => v.verse),
    [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  );
  assert.ok(!fromDoc.verses.some((v) => v.verse === 27));

  // Discontinuous bible cite from a document.
  const dots = [
    unit(1, 'primera carta de san juan', 4, 8, '8 Dios es amor'),
    unit(2, 'primera carta de san juan', 4, 16, '16 Dios es amor'),
    unit(3, 'primera carta de san juan', 4, 9, '9 no citado'),
  ];
  const picked = mod.resolveCitedPassageFromLocalRef(
    'bible-pueblo-de-dios-es',
    1,
    'cf. 1 Jn 4,8.16',
    dots,
  );
  assert.deepStrictEqual(
    picked.verses.map((v) => v.verse),
    [8, 16],
  );
  assert.strictEqual(picked.verses[1].spanBreakBefore, true);

  // Doc-to-doc: only the anchored unit.
  const cic = [
    unit(13, null, 0, 0, 'unidad previa', { consecutivo: '13' }),
    unit(14, null, 0, 0, 'unidad de la fe y del conocimiento', {
      consecutivo: '14',
    }),
    unit(15, null, 0, 0, 'unidad siguiente', { consecutivo: '15' }),
  ];
  const docCite = mod.resolveCitedPassageFromLocalRef(
    'cic-es',
    14,
    'CIC 14',
    cic,
  );
  assert.ok(docCite);
  assert.strictEqual(docCite.verses.length, 1);
  assert.strictEqual(docCite.verses[0].index, 14);
  assert.ok(docCite.verses[0].text.includes('unidad de la fe'));
  assert.ok(!docCite.verses[0].text.includes('previa'));
  assert.ok(!docCite.verses[0].text.includes('siguiente'));

  console.log('ok resolve-cited-passage');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
