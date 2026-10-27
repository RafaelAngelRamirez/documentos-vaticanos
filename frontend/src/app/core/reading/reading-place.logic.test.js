/**
 * Bookmark predicate for one cite.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/reading/reading-place.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'reading-place.logic.ts')).href
  );
  const { unitHasBookmark } = mod;

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
  assert.strictEqual(unitHasBookmark(marks, 'cic-es', 1.5), false);
  assert.strictEqual(unitHasBookmark(undefined, 'cic-es', 0), false);

  console.log('reading-place.logic: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
