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

  // Holy See research sources present after offline import
  const holySee = a.saints.filter(
    (s) =>
      s.sourceUrl &&
      (/vaticannews\.va/i.test(s.sourceUrl) ||
        /vaticanstate\.va/i.test(s.sourceUrl)),
  );
  assert.ok(
    holySee.length >= 1,
    '≥1 saint from vaticannews.va or vaticanstate.va',
  );
  const withHolyBio = holySee.filter((s) => (s.bio || '').length > 40);
  assert.ok(withHolyBio.length >= 1, 'holy-see saint has bio');

  const bruno = a.saints.find(
    (s) =>
      /bruno/i.test(s.id) ||
      /Bruno.*Segni|Segni.*Bruno/i.test(s.name) ||
      /Bruno.*Segni/i.test(s.displayName || ''),
  );
  assert.ok(bruno, 'Bruno de Segni present in pack');
  assert.ok((bruno.bio || '').length > 40, 'Bruno bio');
  assert.ok(
    bruno.sourceUrl &&
      (/vaticannews\.va|vaticanstate\.va/i.test(bruno.sourceUrl)),
    `Bruno sourceUrl official: ${bruno.sourceUrl}`,
  );
  assert.ok(
    (bruno.feastDays || []).includes('07-18'),
    `Bruno feastDays ${JSON.stringify(bruno.feastDays)}`,
  );

  assert.ok(
    a.sourceNote &&
      /vaticannews|vaticanstate|Vatican News|liturgy\/saints/i.test(a.sourceNote),
    'sourceNote names research sources',
  );

  console.log('ok santoral-offline-load');
  console.log(
    JSON.stringify({
      saints: a.saints.length,
      withBio: withBio.length,
      withDocs: withDocs.length,
      withSource: withSource.length,
      holySee: holySee.length,
      agustinDocs: (ag.documentIds || []).length,
      bruno: {
        id: bruno.id,
        bioLen: (bruno.bio || '').length,
        sourceUrl: bruno.sourceUrl,
        feastDays: bruno.feastDays,
      },
    }),
  );
}

main();
