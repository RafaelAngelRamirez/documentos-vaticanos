/**
 * Real resolve tests against shipped santoral-resolve.logic.ts + offline pack.
 *
 * Run from repo root:
 *   node --experimental-strip-types frontend/src/app/core/santoral/santoral-resolve.logic.test.js
 * Or from frontend/:
 *   npm run test:santoral
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
// …/frontend/src/app/core/santoral → repo root is 5 levels up
const REPO = path.resolve(HERE, '../../../../../');
const LOGIC = path.join(HERE, 'santoral-resolve.logic.ts');
const PACK = path.join(REPO, 'frontend/src/assets/corpus/santoral/manifest.json');
const CORPUS = path.join(REPO, 'frontend/src/assets/corpus/manifest.json');

async function main() {
  assert.ok(fs.existsSync(LOGIC), `missing ${LOGIC}`);
  assert.ok(fs.existsSync(PACK), `missing offline pack ${PACK}`);
  assert.ok(fs.existsSync(CORPUS), `missing corpus ${CORPUS}`);

  const logic = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  assert.strictEqual(
    logic.SANTORAL_MANIFEST_URL,
    'assets/corpus/santoral/manifest.json',
  );

  const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  const docs = (corpus.documents || []).map((d) => ({
    id: d.id,
    title: d.title,
    author: d.author,
  }));
  const saints = pack.saints || [];
  assert.ok(saints.length >= 1, 'pack must have ≥1 saint');

  const ag = saints.find((s) => s.id === 'agustin-hipona');
  assert.ok(ag, 'Agustín de Hipona must be in pack');

  const ids = logic.documentIdsForSaint(ag, docs);
  assert.ok(
    ids.includes('agustin-02-confesiones-es'),
    `Agustín related docs must include confesiones; got ${ids.slice(0, 8).join(',')}`,
  );
  assert.ok(
    ids.length > 1,
    `Agustín must list more than one pack document; got ${ids.length}`,
  );

  // Confesiones → saint mapping
  const conf = docs.find((d) => d.id === 'agustin-02-confesiones-es');
  assert.ok(conf, 'corpus must ship confesiones');
  const mapped = logic.saintForDocument(conf, saints);
  assert.ok(mapped, 'confesiones maps to a saint');
  assert.strictEqual(mapped.id, 'agustin-hipona');

  const siblings = logic.siblingDocumentIds(conf, saints, docs);
  assert.ok(
    siblings.includes('agustin-16-ciudad-de-dios-1-es') ||
      siblings.some((id) => id.startsWith('agustin-')),
    'siblings of Confesiones include other Agustín packs',
  );
  assert.ok(!siblings.includes('agustin-02-confesiones-es'));

  // normalize + match
  assert.ok(
    logic.matchAuthorToSaint('San Agustín de Hipona', ag),
    'San Agustín de Hipona matches',
  );
  assert.ok(logic.matchAuthorToSaint('Agustín de Hipona', ag));

  const withBio = saints.filter((s) => (s.bio || '').length > 40);
  assert.ok(withBio.length >= 1, 'at least one saint with bio');

  console.log('ok santoral-resolve');
  console.log(
    JSON.stringify({
      saints: saints.length,
      agustinDocs: ids.length,
      withBio: withBio.length,
      confesiones: ids.includes('agustin-02-confesiones-es'),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
