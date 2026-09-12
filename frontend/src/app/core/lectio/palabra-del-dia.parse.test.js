/**
 * Vatican News Palabra del día RSS parser.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/lectio/palabra-del-dia.parse.test.js
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

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Palabra del día</title>
    <item>
      <title>Evangelio y palabra del día 11 septiembre 2026</title>
      <guid>https://www.vaticannews.va/es/evangelio-de-hoy/2026/09/11.html</guid>
      <description><![CDATA[
        <p>Lectura de la primera carta del apóstol san Pablo a los Corintios</p>
        <p>1 Corintios 9, 16-19. 22-27</p>
        <p>Hermanos: No tengo por qué presumir de predicar el Evangelio.</p>
        <p>Lectura del santo evangelio según san Lucas</p>
        <p>Lucas 6, 39-42</p>
        <p>En aquel tiempo, Jesús propuso a sus discípulos este ejemplo.</p>
        <p>El Evangelio de Lucas nos ha recordado la pregunta de Jesús. (Papa Francisco - Homilía en Santa Marta, 5 de diciembre de 2019)</p>
      ]]></description>
    </item>
  </channel>
</rss>`;

async function main() {
  const {
    parsePalabraDelDiaRss,
    dateIsoFromPalabraUrl,
    palabraRssUrlForLocale,
  } = await import(
    pathToFileURL(path.join(__dirname, 'palabra-del-dia.parse.ts')).href
  );

  assert.strictEqual(
    dateIsoFromPalabraUrl(
      'https://www.vaticannews.va/es/evangelio-de-hoy/2026/09/11.html',
    ),
    '2026-09-11',
  );
  assert.ok(palabraRssUrlForLocale('es').includes('/es/'));
  assert.ok(palabraRssUrlForLocale('en').includes('/en/'));

  const row = parsePalabraDelDiaRss(FIXTURE, '2026-09-11');
  assert.ok(row, 'parsed item');
  assert.strictEqual(row.dateIso, '2026-09-11');
  assert.ok(row.gospel, 'gospel');
  assert.ok(/Lucas 6/.test(row.gospel.cite), row.gospel.cite);
  assert.ok(/Jesús/.test(row.gospel.text));
  assert.ok(row.firstReading, 'first reading');
  assert.ok(/Corintios/.test(row.firstReading.cite));
  assert.ok(row.reflection, 'papal reflection');
  assert.ok(/pregunta de Jesús/.test(row.reflection.text));
  assert.ok(
    row.reflection.attribution && /Francisco/.test(row.reflection.attribution),
    row.reflection.attribution,
  );

  assert.strictEqual(parsePalabraDelDiaRss(''), null);
  console.log('ok palabra-del-dia.parse');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
