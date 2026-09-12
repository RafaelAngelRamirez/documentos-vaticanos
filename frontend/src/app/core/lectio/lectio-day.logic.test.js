/**
 * Lectio day payload.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/lectio/lectio-day.logic.test.js
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
  const { localDateIso, snippet, buildLectioDay } = await import(
    pathToFileURL(path.join(__dirname, 'lectio-day.logic.ts')).href
  );

  const d = new Date(2026, 8, 11, 10, 0, 0); // 11 Sep 2026 local
  assert.strictEqual(localDateIso(d), '2026-09-11');
  assert.ok(snippet('abc def', 10).length <= 10 || snippet('abc', 10) === 'abc');
  assert.strictEqual(snippet('hello world', 400), 'hello world');

  const day = buildLectioDay({
    now: d,
    saints: [{ id: 'bruno', name: 'San Bruno' }],
    palabra: {
      dateIso: '2026-09-11',
      title: 't',
      sourceUrl: 'https://www.vaticannews.va/es/evangelio-de-hoy/2026/09/11.html',
      firstReading: null,
      gospel: null,
      reflection: { text: 'Palabras del Papa.', attribution: 'Francisco' },
    },
  });
  assert.strictEqual(day.dateIso, '2026-09-11');
  assert.strictEqual(day.methodDoc.documentId, 'vd-es');
  assert.strictEqual(day.methodDoc.consecutivo, '87');
  assert.strictEqual(day.saints[0].id, 'bruno');
  assert.strictEqual(day.reflectionText, 'Palabras del Papa.');
  assert.ok(day.gospel && day.gospel.role === 'gospel', 'OT Friday has packed gospel');
  assert.match(day.gospel.cite, /Lc 6/);

  const offline = buildLectioDay({ now: d });
  assert.ok(offline.reflectionText && offline.reflectionText.length > 80);
  assert.match(offline.reflectionAttribution || '', /Verbum Domini/);
  console.log('ok lectio-day.logic');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
