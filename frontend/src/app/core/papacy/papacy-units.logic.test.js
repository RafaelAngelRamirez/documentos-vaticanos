/**
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/papacy/papacy-units.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;

async function main() {
  const logic = await import(
    pathToFileURL(path.join(HERE, 'papacy-units.logic.ts')).href + `?t=${Date.now()}`
  );
  assert.strictEqual(logic.PAPACY_DOC_PREFIX, 'papacy:');
  assert.strictEqual(logic.popeDocumentId('francisco'), 'papacy:francisco');
  assert.strictEqual(logic.parsePopeDocumentId('papacy:francisco'), 'francisco');
  assert.ok(logic.isPopeDocumentId('papacy:leon-xiv'));
  assert.ok(!logic.isPopeDocumentId('cic-es'));
  assert.ok(!logic.isPopeDocumentId('santoral:pedro'));

  const pope = {
    id: 'pedro',
    ordinal: 1,
    name: 'Pedro',
    bio: 'Primera línea.\n\nSegunda línea más larga para el lector.\n\nTercera.',
    locale: 'es',
    sourceUrl: 'https://www.vatican.va/content/vatican/es/holy-father/san-pietro.html',
  };
  const loaded = logic.popeToReadingDocument(pope);
  assert.ok(loaded);
  assert.strictEqual(loaded.meta.id, 'papacy:pedro');
  assert.strictEqual(loaded.meta.kind, 'pope-bio');
  assert.ok(loaded.documento.length >= 2);
  assert.ok(logic.canContinuePopeReading({ documentId: 'papacy:pedro', unitIndex: 2 }, 'pedro'));
  assert.ok(
    !logic.canContinuePopeReading({ documentId: 'papacy:pedro', unitIndex: 0 }, 'pedro'),
  );
  console.log('OK papacy-units');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
