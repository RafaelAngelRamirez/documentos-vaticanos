/**
 * Offline reflection varies by liturgical day and stays inside the corpus.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/lectio/lectio-reflection.logic.test.js
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

function cleanUnit(raw) {
  return String(raw || '')
    .replace(/\s*\(\s*\[\+\[\d+\]\+\]\s*\)/g, '')
    .replace(/\[\+\[\d+\]\+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\d+\.\s*/, '');
}

async function main() {
  const { selectLectioReflection } = await import(
    pathToFileURL(path.join(__dirname, 'lectio-reflection.logic.ts')).href
  );
  const { liturgicalDateOf } = await import(
    pathToFileURL(
      path.join(__dirname, '../liturgia/liturgical-date.logic.ts'),
    ).href
  );
  const { LECTIO_REFLECTION_CATALOG: catalog } = await import(
    pathToFileURL(path.join(__dirname, 'lectio-reflection.catalog.ts')).href
  );
  const corpus = path.resolve(
    __dirname,
    '../../../../../documentos/corpus/documents',
  );

  assert.ok(catalog.entries.length >= 40, 'catalog covers the year');
  const seen = new Set();
  for (const entry of catalog.entries) {
    assert.ok(!seen.has(entry.id), entry.id);
    seen.add(entry.id);
    assert.ok(entry.text && entry.text.length >= 45, entry.id);
    assert.ok(entry.attribution && entry.attribution.length > 8, entry.id);
    assert.ok(!/vaticannews/i.test(entry.text + (entry.deep || '')), entry.id);
    const body = JSON.parse(
      fs.readFileSync(
        path.join(corpus, entry.documentId, 'content.json'),
        'utf8',
      ),
    );
    const unit = cleanUnit(body[entry.unitIndex].contenido);
    assert.ok(unit.includes(entry.text), `text not in ${entry.id}`);
    if (entry.deep) assert.ok(unit.includes(entry.deep), `deep not in ${entry.id}`);
    assert.strictEqual(
      String(body[entry.unitIndex].consecutivo),
      String(entry.consecutivo),
    );
  }

  const pools = {};
  for (const entry of catalog.entries) {
    if (entry.feast) continue;
    pools[entry.season] = (pools[entry.season] || 0) + 1;
  }
  for (const season of ['advent', 'christmas', 'lent', 'easter', 'ordinary']) {
    assert.ok(pools[season] > 1, `${season} pool`);
    assert.ok(pools[season] % 7 !== 0, `${season} pool should shift across weeks`);
  }

  const christmas = selectLectioReflection(liturgicalDateOf(new Date(2026, 11, 25)));
  assert.strictEqual(christmas.id, 'fiesta-navidad');
  assert.match(christmas.attribution, /Verbum Domini n\. 12/);
  assert.match(christmas.text, /pesebre/);

  const boxing = selectLectioReflection(liturgicalDateOf(new Date(2026, 11, 26)));
  assert.notStrictEqual(boxing.id, christmas.id);

  const fri = selectLectioReflection(liturgicalDateOf(new Date(2026, 8, 11)));
  const sat = selectLectioReflection(liturgicalDateOf(new Date(2026, 8, 12)));
  assert.notStrictEqual(fri.id, sat.id);
  assert.strictEqual(
    fri.id,
    selectLectioReflection(liturgicalDateOf(new Date(2026, 8, 11))).id,
  );

  const advent = selectLectioReflection(liturgicalDateOf(new Date(2026, 11, 6)));
  const easter = selectLectioReflection(liturgicalDateOf(new Date(2026, 3, 5)));
  assert.strictEqual(easter.id, 'fiesta-pascua');
  assert.notStrictEqual(advent.id, easter.id);

  const goodFriday = selectLectioReflection(liturgicalDateOf(new Date(2026, 3, 3)));
  const vigil = selectLectioReflection(liturgicalDateOf(new Date(2026, 3, 4)));
  assert.notStrictEqual(goodFriday.id, vigil.id);
  assert.notStrictEqual(vigil.id, easter.id);

  let cursor = new Date(2026, 0, 1);
  const end = new Date(2027, 0, 1);
  let days = 0;
  while (cursor < end) {
    const row = selectLectioReflection(liturgicalDateOf(cursor));
    assert.ok(row.text && row.attribution, cursor.toDateString());
    days += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  assert.strictEqual(days, 365);

  console.log('ok lectio-reflection.logic');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
