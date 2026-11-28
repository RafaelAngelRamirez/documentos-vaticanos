/**
 * Neighbor units outside a cited run.
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/reading/cited-passage-context.logic.test.js
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

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'cited-passage-context.logic.ts')).href
  );

  assert.strictEqual(mod.nextCitedContextIndex(10, 'before', 100), 9);
  assert.strictEqual(mod.nextCitedContextIndex(0, 'before', 100), null);
  assert.strictEqual(mod.nextCitedContextIndex(10, 'after', 12), 11);
  assert.strictEqual(mod.nextCitedContextIndex(11, 'after', 12), null);
  assert.strictEqual(mod.nextCitedContextIndex(3, 'after', 0), null);

  const bible = {
    index_array: 33825,
    contenido: '12 Así organizó a los santos',
    biblia: { libro: 'carta a los efesios', capitulo: '4', versiculo: 12 },
  };
  const before = mod.citedContextVerse(bible, 33825);
  assert.deepStrictEqual(before, {
    index: 33825,
    chapter: 4,
    verse: 12,
    text: 'Así organizó a los santos',
  });

  const paragraph = mod.citedContextVerse(
    { consecutivo: '17', contenido: '17 unidad fuera de la cita', index_array: 16 },
    16,
  );
  assert.strictEqual(paragraph.verse, 17);
  assert.strictEqual(paragraph.text, 'unidad fuera de la cita');

  assert.strictEqual(
    mod.citedContextVerse({ consecutivo: '1', contenido: '   ' }, 1),
    null,
  );
  assert.strictEqual(mod.citedContextVerse(undefined, 4), null);

  const units = [
    { consecutivo: '1', contenido: '' },
    { consecutivo: '2', contenido: '2 párrafo anterior' },
    { consecutivo: '3', contenido: '3 citado' },
  ];
  assert.deepStrictEqual(mod.stepCitedContext(units, 2, 'before', 3), {
    kind: 'verse',
    edge: 1,
    verse: {
      index: 1,
      chapter: 0,
      verse: 2,
      text: 'párrafo anterior',
    },
  });
  assert.deepStrictEqual(mod.stepCitedContext(units, 1, 'before', 3), {
    kind: 'skip',
    edge: 0,
  });
  assert.deepStrictEqual(mod.stepCitedContext(units, 0, 'before', 3), {
    kind: 'end',
  });
  assert.deepStrictEqual(mod.stepCitedContext(units, 2, 'after', 3), {
    kind: 'end',
  });
  assert.deepStrictEqual(mod.stepCitedContext([units[0]], 0, 'after', 3), {
    kind: 'load',
    index: 1,
  });

  console.log('cited-passage-context.logic.test.js ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
