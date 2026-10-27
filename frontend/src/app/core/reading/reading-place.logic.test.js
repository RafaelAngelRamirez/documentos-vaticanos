/**
 * Section of a unit, and whether that unit already has a bookmark.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/reading/reading-place.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'reading-place.logic.ts')).href
  );
  const { sectionAt, unitHasBookmark } = mod;

  const toc = [
    { num: 'I', title: 'Prólogo', unitIndex: 0 },
    { num: 'II', title: 'Fe', unitIndex: 10 },
    { num: 'III', title: 'Moral', unitIndex: 40 },
  ];

  assert.strictEqual(sectionAt(null, 0), null);
  assert.strictEqual(sectionAt([], 3), null);
  assert.strictEqual(sectionAt(toc, -1), null);
  assert.strictEqual(sectionAt(toc, 1.5), null);
  assert.strictEqual(sectionAt(toc, Number.NaN), null);

  assert.strictEqual(sectionAt(toc, 0).title, 'Prólogo');
  assert.strictEqual(sectionAt(toc, 9).title, 'Prólogo');
  assert.strictEqual(sectionAt(toc, 10).title, 'Fe');
  assert.strictEqual(sectionAt(toc, 39).num, 'II');
  assert.strictEqual(sectionAt(toc, 40).title, 'Moral');
  assert.strictEqual(sectionAt(toc, 900).title, 'Moral');

  const lateStart = [{ title: 'Capítulo', unitIndex: 4 }];
  assert.strictEqual(sectionAt(lateStart, 3), null);
  assert.strictEqual(sectionAt(lateStart, 4).title, 'Capítulo');

  const tied = [
    { title: 'primero', unitIndex: 2 },
    { title: 'roto', unitIndex: 1.2 },
    { title: 'segundo', unitIndex: 2 },
  ];
  assert.strictEqual(sectionAt(tied, 2).title, 'segundo');

  const marks = [
    { documentId: 'cic-es', unitIndex: 4, kind: 'marcador' },
    { documentId: 'cic-es', unitIndex: 4, kind: 'subrayado' },
    { documentId: 'cic-es', unitIndex: 5, kind: 'nota' },
    { documentId: 'lg-es', unitIndex: 4, kind: 'marcador' },
  ];
  assert.strictEqual(unitHasBookmark(marks, 'cic-es', 4), true);
  assert.strictEqual(unitHasBookmark(marks, 'cic-es', 5), false);
  assert.strictEqual(unitHasBookmark(marks, 'dv-es', 4), false);
  assert.strictEqual(unitHasBookmark(marks, '', 4), false);
  assert.strictEqual(unitHasBookmark(null, 'cic-es', 4), false);
  assert.strictEqual(unitHasBookmark(marks, 'cic-es', -1), false);

  const punto = fs.readFileSync(
    path.resolve(__dirname, '../../components/punto/punto/punto.component.ts'),
    'utf8',
  );
  assert.ok(
    punto.includes('unitHasBookmark'),
    'the star uses the cite bookmark check',
  );
  assert.ok(
    !punto.includes(".kind === 'marcador'"),
    'the star does not reimplement the bookmark predicate',
  );

  console.log('reading-place.logic: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
