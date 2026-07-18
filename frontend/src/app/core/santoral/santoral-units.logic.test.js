/**
 * Real pack bio → reading units (shipped santoral-units.logic.ts).
 *
 * Run:
 *   node --experimental-strip-types frontend/src/app/core/santoral/santoral-units.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../../');
const LOGIC = path.join(HERE, 'santoral-units.logic.ts');
const PACK = path.join(REPO, 'frontend/src/assets/corpus/santoral/manifest.json');

async function main() {
  assert.ok(fs.existsSync(LOGIC), `missing ${LOGIC}`);
  assert.ok(fs.existsSync(PACK), `missing pack ${PACK}`);

  const logic = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  assert.strictEqual(logic.SANTORAL_DOC_PREFIX, 'santoral:');

  const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  const saints = pack.saints || [];
  assert.ok(saints.length >= 1, 'pack must have saints');

  // Prefer a multi-paragraph vatican bio
  const withBio = saints
    .filter((s) => (s.bio || '').length > 400)
    .sort((a, b) => (b.bio || '').length - (a.bio || '').length);
  assert.ok(withBio.length >= 1, 'need a saint with real bio');
  const sample = withBio[0];

  const units = logic.bioToReadingUnits(sample.bio);
  assert.ok(
    units.length >= 2,
    `bio of ${sample.id} must yield ≥2 units; got ${units.length}`,
  );
  for (const u of units) {
    assert.strictEqual(typeof u.index_array, 'number');
    assert.ok(u.consecutivo, 'consecutivo required');
    assert.ok(
      String(u.contenido || '').trim().length > 0,
      `unit ${u.index_array} empty`,
    );
  }
  // Stable indices 0..n-1
  assert.strictEqual(units[0].index_array, 0);
  assert.strictEqual(units[units.length - 1].index_array, units.length - 1);

  // Document id namespace
  const docId = logic.saintDocumentId(sample.id);
  assert.ok(docId.startsWith('santoral:'));
  assert.strictEqual(logic.parseSaintDocumentId(docId), sample.id);
  assert.ok(logic.isSaintDocumentId(docId));
  assert.ok(!logic.isSaintDocumentId('cic-es'));
  assert.ok(!logic.isSaintDocumentId(sample.id)); // bare id is not namespaced

  // Exit path of shared lector: saint → /santoral/:id, corpus → /documento/:id
  assert.strictEqual(
    logic.coverPathForDocumentId(docId),
    `/santoral/${sample.id}`,
  );
  assert.deepStrictEqual(logic.coverNavCommandsForDocumentId(docId), [
    '/santoral',
    sample.id,
  ]);
  assert.strictEqual(
    logic.coverPathForDocumentId('cic-es'),
    '/documento/cic-es',
  );
  assert.deepStrictEqual(logic.coverNavCommandsForDocumentId('cic-es'), [
    '/documento',
    'cic-es',
  ]);

  // BackService hierarchy (parentPathForAppUrl) — real pure path used by service
  assert.strictEqual(
    logic.parentPathForAppUrl(`/leyendo/${docId}/punto/2`),
    `/santoral/${sample.id}`,
  );
  assert.strictEqual(
    logic.parentPathForAppUrl(`/leyendo/${docId}`),
    `/santoral/${sample.id}`,
  );
  assert.strictEqual(
    logic.parentPathForAppUrl('/leyendo/cic-es/punto/0'),
    '/documento/cic-es',
  );
  assert.strictEqual(
    logic.parentPathForAppUrl(`/santoral/${sample.id}`),
    '/santoral',
  );
  // Encoded colon in path segment
  assert.strictEqual(
    logic.parentPathForAppUrl(
      `/leyendo/${encodeURIComponent(docId)}/punto/0`,
    ),
    `/santoral/${sample.id}`,
  );

  const loaded = logic.saintToReadingDocument(sample);
  assert.ok(loaded, 'saintToReadingDocument');
  assert.strictEqual(loaded.meta.id, docId);
  assert.strictEqual(loaded.meta.kind, 'saint-bio');
  assert.ok(loaded.documento.length >= 2);
  assert.strictEqual(loaded.meta.unitCount, loaded.documento.length);
  assert.ok(loaded.indice && loaded.indice.indice);

  // Agustín short bio still yields ≥1 unit
  const ag = saints.find((s) => s.id === 'agustin-hipona');
  if (ag) {
    const agUnits = logic.bioToReadingUnits(ag.bio);
    assert.ok(agUnits.length >= 1, 'Agustín bio → ≥1 unit');
    const agDoc = logic.saintToReadingDocument(ag);
    assert.strictEqual(agDoc.meta.id, 'santoral:agustin-hipona');
  }

  // Continue CTA semantics
  assert.strictEqual(
    logic.canContinueSaintReading(
      { documentId: docId, unitIndex: 3 },
      sample.id,
    ),
    true,
  );
  assert.strictEqual(
    logic.canContinueSaintReading(
      { documentId: docId, unitIndex: 0 },
      sample.id,
    ),
    false,
  );
  assert.strictEqual(
    logic.canContinueSaintReading(
      { documentId: 'cic-es', unitIndex: 5 },
      sample.id,
    ),
    false,
  );
  assert.strictEqual(logic.canContinueSaintReading(null, sample.id), false);

  const toc = logic.tocFromSaintUnits(units, 12);
  assert.ok(toc.length >= 1);
  assert.strictEqual(typeof toc[0].unitIndex, 'number');

  const seed = logic.relatedSeedForSaint(sample);
  assert.ok(seed.length > 10, 'related seed non-trivial');

  // Emiliano: short martyrology must not seed on "emperador/época" noise
  const emiliano = saints.find((s) => s.id === 'emiliano') || {
    id: 'emiliano',
    name: 'Emiliano',
    displayName: 'San Emiliano',
    role: 'mártir de la Mesia',
    bio:
      'En la época del emperador Julián, el Apóstata, en el año 362, el vicario de la capital fue a Durostoro, en Mesia – actualmente Rumania – para restaurar el paganismo. El joven Emiliano, cristiano, volcó el altar y destruyó los ídolos para los sacrificios, por lo que fue condenado al martirio.',
  };
  const emSeed = logic.relatedSeedForSaint(emiliano);
  assert.ok(emSeed.length > 5, 'emiliano seed present');
  const emFold = emSeed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  assert.ok(!/\bemperador\b/.test(emFold), 'seed drops emperador noise');
  assert.ok(!/\bepoca\b/.test(emFold), 'seed drops epoca noise');
  assert.ok(
    /\bemiliano\b/.test(emFold) || /\bmartir/.test(emFold),
    'seed keeps identity / martyr anchors',
  );
  const bioTerms = logic.distinctiveTermsFromSaintBio(emiliano.bio, 12);
  assert.ok(
    bioTerms.every((t) => !logic.SAINT_RELATED_SEED_NOISE.has(t)),
    'bio terms exclude noise set',
  );
  assert.ok(
    !bioTerms.includes('del') && !bioTerms.includes('para'),
    'function words not treated as anchors',
  );
  assert.ok(
    bioTerms.some((t) =>
      ['emiliano', 'julian', 'apostata', 'mesia', 'durostoro', 'martirio', 'idolos', 'paganismo'].includes(
        t,
      ),
    ),
    'bio terms keep distinctive anchors',
  );
  // Empty-ish saint → no seed (panel hides)
  assert.strictEqual(
    logic.relatedSeedForSaint({ id: 'x', name: 'San', bio: 'En la época del emperador.' }),
    '',
    'noise-only bio yields empty seed',
  );

  console.log('ok santoral-units');
  console.log(
    JSON.stringify({
      sampleId: sample.id,
      units: units.length,
      docId,
      toc: toc.length,
      seedLen: seed.length,
      emSeedLen: emSeed.length,
      bioTerms,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
