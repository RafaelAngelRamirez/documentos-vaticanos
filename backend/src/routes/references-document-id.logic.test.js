/**
 * documentId filter for POST /me/references.
 * From the repo root:
 *   bash scripts/node-strip-types.sh backend/src/routes/references-document-id.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'references-document-id.logic.ts')).href
  );
  const { referenceDocumentId } = mod;

  assert.strictEqual(referenceDocumentId('cic-es'), 'cic-es');
  assert.strictEqual(referenceDocumentId('  cic-es  '), 'cic-es');
  assert.strictEqual(referenceDocumentId('a'), 'a');
  assert.strictEqual(referenceDocumentId('9abc'), '9abc');
  assert.strictEqual(referenceDocumentId('santoral:alejandrina'), 'santoral:alejandrina');
  assert.strictEqual(
    referenceDocumentId('santoral:agustin-hipona'),
    'santoral:agustin-hipona',
  );
  assert.strictEqual(referenceDocumentId('papacy:leon-xiv'), 'papacy:leon-xiv');
  assert.strictEqual(referenceDocumentId('papacy:francisco'), 'papacy:francisco');
  assert.strictEqual(
    referenceDocumentId(' santoral:alejandrina '),
    'santoral:alejandrina',
  );
  assert.strictEqual(
    referenceDocumentId('santoral: alejandrina'),
    'santoral:alejandrina',
  );
  assert.strictEqual(
    referenceDocumentId('santoral%3Aalejandrina'),
    'santoral:alejandrina',
  );
  assert.strictEqual(referenceDocumentId('papacy%3Aleon-xiv'), 'papacy:leon-xiv');

  assert.strictEqual(referenceDocumentId(null), null);
  assert.strictEqual(referenceDocumentId(undefined), null);
  assert.strictEqual(referenceDocumentId(''), null);
  assert.strictEqual(referenceDocumentId('   '), null);
  assert.strictEqual(referenceDocumentId(12), null);
  assert.strictEqual(referenceDocumentId('santoral:'), null);
  assert.strictEqual(referenceDocumentId('papacy:'), null);
  assert.strictEqual(referenceDocumentId('santoral:   '), null);
  assert.strictEqual(referenceDocumentId('papacy:   '), null);
  assert.strictEqual(referenceDocumentId('CIC'), null);
  assert.strictEqual(referenceDocumentId('Cic-es'), null);
  assert.strictEqual(referenceDocumentId('-cic'), null);
  assert.strictEqual(referenceDocumentId('Catecismo de la Iglesia Católica'), null);
  assert.strictEqual(referenceDocumentId('LG 16'), null);
  assert.strictEqual(referenceDocumentId('Gn 1'), null);
  assert.strictEqual(referenceDocumentId('%'), null);
  assert.strictEqual(referenceDocumentId('santoral%'), null);

  const route = fs.readFileSync(path.join(__dirname, 'references.ts'), 'utf8');
  assert.strictEqual(route.includes('/^[a-z0-9-]+$/i'), false);
  assert.strictEqual(route.includes('referenceDocumentId(req.body?.documentId)'), true);
  assert.strictEqual(route.includes("error: 'documentId invalid'"), true);

  console.log('reference documentId ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
