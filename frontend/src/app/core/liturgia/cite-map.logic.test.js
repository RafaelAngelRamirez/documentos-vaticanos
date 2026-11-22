/**
 * Cite-map preload helpers (indexes without full bible parse).
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/liturgia/cite-map.logic.test.js
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

function unit(index, book, chapter, verse) {
  return {
    index_array: index,
    biblia: { libro: book, capitulo: String(chapter), versiculo: verse },
  };
}

async function main() {
  const mapMod = await import(
    pathToFileURL(path.join(__dirname, 'cite-map.logic.ts')).href
  );
  const citeMod = await import(
    pathToFileURL(path.join(__dirname, 'bible-cite.logic.ts')).href
  );

  const units = [
    unit(0, 'apocalipsis', 7, 1),
    unit(1, 'apocalipsis', 7, 2),
    unit(2, 'apocalipsis', 7, 3),
    unit(3, 'apocalipsis', 7, 4),
    unit(4, 'apocalipsis', 7, 9),
    unit(5, 'apocalipsis', 7, 10),
    unit(6, 'apocalipsis', 7, 11),
    unit(7, 'apocalipsis', 7, 12),
    unit(8, 'apocalipsis', 7, 13),
    unit(9, 'apocalipsis', 7, 14),
  ];
  const map = mapMod.buildBibleCiteMap(units);
  assert.ok(map && map.v === 1);
  assert.strictEqual(map.books.apocalipsis['7']['2'], 1);

  const passage = citeMod.parseLectionaryPassage('Ap 7,2-4.9-14');
  assert.ok(passage);
  const idxs = mapMod.unitIndexesForPassage(map, passage);
  assert.deepStrictEqual(idxs, [1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const ranges = mapMod.mergeUnitRanges(idxs, 40);
  assert.deepStrictEqual(ranges, [{ from: 1, to: 10 }]);

  const split = mapMod.mergeUnitRanges([1, 2, 100, 101], 10);
  assert.deepStrictEqual(split, [
    { from: 1, to: 3 },
    { from: 100, to: 102 },
  ]);

  const bare = [];
  bare[1] = { contenido: '2 dos olivos' };
  bare[3] = { contenido: '4 el hueco' };
  bare[4] = { contenido: '9 despues del salto' };
  const jumped = citeMod.parseLectionaryPassage('Ap 7,2.9');
  const stamped = mapMod.addressUnitsFromCiteMap(bare, map, jumped);
  assert.strictEqual(stamped[1].biblia.libro, 'apocalipsis');
  assert.strictEqual(stamped[1].biblia.versiculo, 2);
  assert.ok(!stamped[3].biblia);
  const shown = citeMod.collectCitedVerses(stamped, jumped);
  assert.deepStrictEqual(
    shown.map((verse) => verse.verse),
    [2, 9],
  );
  assert.ok(!shown.some((verse) => verse.text.includes('hueco')));

  console.log('ok cite-map.logic');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
