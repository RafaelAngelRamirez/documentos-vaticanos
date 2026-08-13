/**
 * First linked corpus pack on Padre / Doctor fichas.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/person/person-reading.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'person-reading.logic.ts')).href
  );
  const { primaryWorkDocumentId } = mod;

  assert.strictEqual(primaryWorkDocumentId(null), null);
  assert.strictEqual(primaryWorkDocumentId(undefined), null);
  assert.strictEqual(primaryWorkDocumentId([]), null);
  assert.strictEqual(
    primaryWorkDocumentId([{ title: 'Carta a los Efesios' }]),
    null,
  );
  assert.strictEqual(
    primaryWorkDocumentId([{ documentId: '   ' }, { documentId: '' }]),
    null,
  );
  assert.strictEqual(
    primaryWorkDocumentId([
      { title: 'Carta a los Efesios' },
      { title: 'Confesiones', documentId: 'agustin-02-confesiones-es' },
      { title: 'De Trinitate', documentId: 'agustin-05-de-trinitate-es' },
    ]),
    'agustin-02-confesiones-es',
  );
  assert.strictEqual(
    primaryWorkDocumentId([
      { documentId: '  carta-diogneto-es  ' },
      { documentId: 'other' },
    ]),
    'carta-diogneto-es',
  );

  console.log('person-reading.logic.test.js: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
