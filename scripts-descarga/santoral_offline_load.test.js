/**
 * Offline pack load check (no network): dual-write paths + content invariants.
 *
 * Run: node scripts-descarga/santoral_offline_load.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOTS = [
  path.join(REPO, 'documentos/corpus/santoral/manifest.json'),
  path.join(REPO, 'frontend/src/assets/corpus/santoral/manifest.json'),
];

function main() {
  for (const file of ROOTS) {
    assert.ok(fs.existsSync(file), `missing ${file}`);
  }

  const a = JSON.parse(fs.readFileSync(ROOTS[0], 'utf8'));
  const b = JSON.parse(fs.readFileSync(ROOTS[1], 'utf8'));
  assert.strictEqual(a.saints.length, b.saints.length, 'dual-write count match');
  assert.ok(a.saints.length >= 1, '≥1 saints');

  const withBio = a.saints.filter((s) => (s.bio || '').length > 40);
  const withDocs = a.saints.filter(
    (s) => Array.isArray(s.documentIds) && s.documentIds.length > 0,
  );
  assert.ok(withBio.length >= 1, '≥1 saint with bio');
  assert.ok(withDocs.length >= 1, '≥1 saint with document links');

  const ag = a.saints.find((s) => s.id === 'agustin-hipona');
  assert.ok(ag, 'agustin present');
  assert.ok(
    (ag.documentIds || []).includes('agustin-02-confesiones-es'),
    'agustin lists confesiones',
  );
  assert.ok((ag.documentIds || []).length > 1);

  // sourceUrl on scraped or seeded when present
  const withSource = a.saints.filter((s) => s.sourceUrl);
  assert.ok(withSource.length >= 1, '≥1 sourceUrl');

  console.log('ok santoral-offline-load');
  console.log(
    JSON.stringify({
      saints: a.saints.length,
      withBio: withBio.length,
      withDocs: withDocs.length,
      withSource: withSource.length,
      agustinDocs: (ag.documentIds || []).length,
    }),
  );
}

main();
