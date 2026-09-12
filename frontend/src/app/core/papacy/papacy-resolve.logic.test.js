/**
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/papacy/papacy-resolve.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../../');
const PACK = path.join(REPO, 'frontend/src/assets/corpus/papacy/manifest.json');

async function main() {
  assert.ok(fs.existsSync(PACK), 'missing papacy pack');
  const logic = await import(
    pathToFileURL(path.join(HERE, 'papacy-resolve.logic.ts')).href + `?t=${Date.now()}`
  );
  const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  const popes = pack.popes || [];
  assert.ok(popes.length >= 266);

  const pedro = logic.popeById('pedro', popes);
  assert.ok(pedro);
  const groups = logic.popesByEra(popes);
  assert.ok(groups.length >= 4);
  assert.ok(groups[0].items[0].ordinal <= groups[0].items.at(-1).ordinal);

  const jp2 = logic.popeById('juan-pablo-ii', popes);
  assert.ok(jp2);
  const found = logic.popeForDocument(
    { id: (jp2.documentIds || [])[0] },
    popes,
  );
  if ((jp2.documentIds || [])[0]) {
    assert.strictEqual(found && found.id, 'juan-pablo-ii');
  }

  const filtered = logic.filterPopes(popes, 'bergoglio');
  assert.ok(filtered.some((p) => p.id === 'francisco'));

  console.log('OK papacy-resolve');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
