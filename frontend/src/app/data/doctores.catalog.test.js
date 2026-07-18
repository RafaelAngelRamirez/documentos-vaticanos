/**
 * Tests for doctores catalog helpers (shipped pure module).
 * Run from frontend/:
 *   node --experimental-strip-types src/app/data/doctores.catalog.test.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const CATALOG = path.join(HERE, 'doctores.ts');
// HERE = frontend/src/app/data → assets at frontend/src/assets
const MANIFEST = path.resolve(
  HERE,
  '../../assets/corpus/manifest.json',
);
// repo root = frontend/src/app/data → ../../../../
const INV = path.resolve(
  HERE,
  '../../../../documentos/doctores-source/inventory/doctores.json',
);

async function loadCatalog() {
  return import(pathToFileURL(CATALOG).href + `?t=${Date.now()}`);
}

async function main() {
  const C = await loadCatalog();

  assert.strictEqual(
    C.DOCTORES_COUNT,
    38,
    'DOCTORES_COUNT must be 38',
  );
  assert.strictEqual(
    C.DOCTORES.length,
    38,
    'catalog must list exactly 38 Doctors',
  );

  const ids = new Set(C.DOCTORES.map((d) => d.id));
  assert.strictEqual(ids.size, 38, 'Doctor ids must be unique');

  // Canonical entries from the research list
  assert.ok(C.doctorById('agustin-hipona'), 'Agustín present');
  assert.ok(C.doctorById('atanasio-alejandria'), 'Atanasio present');
  assert.ok(C.doctorById('ireneo-lyon'), 'Ireneo present');
  assert.ok(C.doctorById('john-henry-newman'), 'Newman present');
  assert.strictEqual(C.doctorById('no-existe'), undefined);

  const newman = C.doctorById('john-henry-newman');
  assert.strictEqual(newman.proclaimedYear, 2025);
  assert.ok(
    newman.proclamationSourceUrl &&
      newman.proclamationSourceUrl.includes('vatican.va'),
    'Newman proclamation URL on vatican.va',
  );

  const atanasio = C.doctorById('atanasio-alejandria');
  const linked = C.linkableWorks(atanasio);
  assert.ok(
    linked.some((w) => w.documentId === 'atanasio-de-incarnatione-en'),
    'Atanasio De Incarnatione linked to new pack',
  );
  assert.ok(
    C.pendingWorks(atanasio).length >= 1,
    'Atanasio still has pending works',
  );

  const agustin = C.doctorById('agustin-hipona');
  assert.ok(
    C.linkableWorks(agustin).length >= 3,
    'Agustín has multiple corpus packs',
  );

  const groups = C.doctoresByEra();
  assert.ok(groups.length >= 4, 'grouped by era');
  const totalGrouped = groups.reduce((n, g) => n + g.items.length, 0);
  assert.strictEqual(totalGrouped, 38);

  const allDocIds = C.allLinkedDocumentIds();
  assert.ok(allDocIds.includes('agustin-02-confesiones-es'));
  assert.ok(allDocIds.includes('cirilo-jerusalen-catequesis-es'));
  assert.ok(allDocIds.includes('atanasio-de-incarnatione-en'));

  // Every linked documentId must exist in the offline manifest
  assert.ok(fs.existsSync(MANIFEST), `manifest missing: ${MANIFEST}`);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const manifestIds = new Set(
    (manifest.documents || []).map((d) => d.id),
  );
  for (const id of allDocIds) {
    assert.ok(
      manifestIds.has(id),
      `catalog documentId not in manifest: ${id}`,
    );
  }

  // Inventory JSON mirrors count
  assert.ok(fs.existsSync(INV), `inventory missing: ${INV}`);
  const inv = JSON.parse(fs.readFileSync(INV, 'utf8'));
  assert.strictEqual(inv.count, 38);
  assert.strictEqual(inv.doctors.length, 38);

  console.log(
    `OK doctores catalog: ${C.DOCTORES.length} doctors, ${allDocIds.length} linked packs`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
