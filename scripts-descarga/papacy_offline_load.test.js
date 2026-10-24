/**
 * Dual-write papacy pack invariants (no network).
 * Run: node papacy_offline_load.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOTS = [
  path.join(REPO, 'documentos/corpus/papacy/manifest.json'),
  path.join(REPO, 'frontend/src/assets/corpus/papacy/manifest.json'),
];

function main() {
  for (const file of ROOTS) {
    assert.ok(fs.existsSync(file), `missing ${file}`);
  }
  const a = JSON.parse(fs.readFileSync(ROOTS[0], 'utf8'));
  const b = JSON.parse(fs.readFileSync(ROOTS[1], 'utf8'));
  assert.strictEqual(a.popes.length, b.popes.length, 'dual-write count');
  assert.ok(a.popes.length >= 266, `got ${a.popes.length} popes`);

  const ids = a.popes.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'unique ids');

  const pedro = a.popes.find((p) => p.id === 'pedro');
  assert.ok(pedro, 'pedro');
  assert.strictEqual(pedro.ordinal, 1);
  assert.strictEqual(pedro.saintId, 'pedro');
  assert.ok((pedro.bio || '').length > 80, 'pedro bio');

  const leo = a.popes[a.popes.length - 1];
  assert.ok(leo.id === 'leon-xiv' || /le[oó]n xiv/i.test(leo.name));
  assert.strictEqual(leo.ordinal, a.popes.length);

  const jp2 = a.popes.find((p) => p.id === 'juan-pablo-ii');
  assert.ok(jp2, 'juan-pablo-ii');
  assert.ok(
    (jp2.documentIds || []).length >= 1,
    'JPII has corpus documents',
  );
  assert.ok(jp2.saintId === 'juan-pablo-ii');

  const withSaint = a.popes.filter((p) => p.saintId);
  assert.ok(withSaint.length >= 70, `saints linked: ${withSaint.length}`);

  const withDocs = a.popes.filter(
    (p) => Array.isArray(p.documentIds) && p.documentIds.length > 0,
  );
  assert.ok(withDocs.length >= 1, '≥1 pope with corpus docs');

  // Chronological ordinals
  for (let i = 0; i < a.popes.length; i++) {
    assert.strictEqual(a.popes[i].ordinal, i + 1, `ordinal ${i + 1}`);
  }

  console.log(
    `OK papacy pack: ${a.popes.length} popes, ${withSaint.length} santoral, ${withDocs.length} with corpus`,
  );
}

main();
