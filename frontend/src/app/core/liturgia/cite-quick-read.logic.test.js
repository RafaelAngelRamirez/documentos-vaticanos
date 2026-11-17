/**
 * Lectura rápida de una cita bíblica resuelta.
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/liturgia/cite-quick-read.logic.test.js
 */
const assert = require('assert');
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

function unit(index, book, chapter, verse, text) {
  return {
    index_array: index,
    contenido: text,
    biblia: { libro: book, capitulo: String(chapter), versiculo: verse },
  };
}

async function main() {
  const { isOfflineBibleId, quickReadVerses } = await import(
    pathToFileURL(path.join(__dirname, 'cite-quick-read.logic.ts')).href
  );

  assert.strictEqual(isOfflineBibleId('bible-pueblo-de-dios-es'), true);
  assert.strictEqual(isOfflineBibleId('cic-es'), false);
  assert.strictEqual(isOfflineBibleId(''), false);

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
  james.push(unit(34900, 'carta de santiago', 3, 1, '1 otro capítulo'));

  const span = quickReadVerses(james, 34855, 'cf. St 2, 14-26');
  assert.deepStrictEqual(
    span.map((row) => row.verse),
    [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  );
  assert.strictEqual(span[0].text, 'texto del versículo 14');
  assert.ok(!span.some((row) => row.text.includes('otro capítulo')));

  const one = quickReadVerses(
    [unit(33833, 'carta a los efesios', 4, 13, '13 hasta que todos lleguemos')],
    33833,
    'Ef 4, 13',
  );
  assert.deepStrictEqual(one, [
    { verse: 13, text: 'hasta que todos lleguemos' },
  ]);

  const dots = [
    unit(1, 'primera carta de san juan', 4, 8, '8 Dios es amor'),
    unit(2, 'primera carta de san juan', 4, 16, '16 Dios es amor'),
    unit(3, 'primera carta de san juan', 4, 9, '9 no citado'),
  ];
  const picked = quickReadVerses(dots, 1, 'cf. 1 Jn 4,8.16');
  assert.deepStrictEqual(
    picked.map((row) => row.verse),
    [8, 16],
  );

  const hole = [
    unit(10, 'evangelio segun san mateo', 22, 36, '36 primero'),
    unit(11, 'evangelio segun san mateo', 22, 38, '38 tercero'),
  ];
  const skipped = quickReadVerses(hole, 10, 'Mt 22,36-38');
  assert.deepStrictEqual(
    skipped.map((row) => row.verse),
    [36, 38],
  );

  const html = quickReadVerses(
    [unit(4, 'evangelio segun san juan', 8, 32, '32 conocerán la <i>verdad</i>')],
    4,
    'Jn 8,32',
  );
  assert.strictEqual(html[0].text, 'conocerán la verdad');

  assert.deepStrictEqual(quickReadVerses(james, 99999, 'St 2, 14-26'), []);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
