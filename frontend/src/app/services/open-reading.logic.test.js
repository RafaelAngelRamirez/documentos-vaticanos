/**
 * open-reading pure helpers — cover CTA entry to immersive reader.
 * Run: bash ../scripts/node-strip-types.sh src/app/services/open-reading.logic.test.js
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
          } catch {
            // fall through
          }
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'open-reading.logic.ts')).href
  );
  const {
    AUTO_NARR_KEY,
    resolveOpenReadingIndex,
    applyAutoNarrFlag,
  } = mod;

  assert.strictEqual(AUTO_NARR_KEY, 'dv.autoNarr');

  assert.strictEqual(resolveOpenReadingIndex(), 0);
  assert.strictEqual(resolveOpenReadingIndex(0), 0);
  assert.strictEqual(resolveOpenReadingIndex(12), 12);
  assert.strictEqual(resolveOpenReadingIndex(3.9), 3);
  assert.strictEqual(resolveOpenReadingIndex(-1), null);
  assert.strictEqual(resolveOpenReadingIndex(NaN), null);
  assert.strictEqual(resolveOpenReadingIndex(Infinity), null);

  const calls = [];
  const fake = {
    setItem(k, v) {
      calls.push([k, v]);
    },
  };
  applyAutoNarrFlag(false, fake);
  assert.deepStrictEqual(calls, []);
  applyAutoNarrFlag(undefined, fake);
  assert.deepStrictEqual(calls, []);
  applyAutoNarrFlag(true, fake);
  assert.deepStrictEqual(calls, [[AUTO_NARR_KEY, '1']]);

  // null storage: no throw
  applyAutoNarrFlag(true, null);

  // throwing storage: no throw
  applyAutoNarrFlag(true, {
    setItem() {
      throw new Error('quota');
    },
  });

  console.log('open-reading.logic.test.js: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
