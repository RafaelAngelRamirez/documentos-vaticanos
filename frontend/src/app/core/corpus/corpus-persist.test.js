/**
 * Corpus durable persistence — drives the SHIPPED pure load module.
 * Fake durable store + controlled HTTP layer. No re-implementation of cache logic.
 *
 * Run:
 *   node --experimental-strip-types src/app/core/corpus/corpus-persist.test.js
 * Or:
 *   npm run test:corpus-persist
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const FRONTEND = path.resolve(HERE, '../../../..');
const LOGIC_TS = path.join(HERE, 'corpus-load.logic.ts');
const SERVICE_TS = path.join(HERE, 'corpus.service.ts');
const IDB_TS = path.join(HERE, 'corpus-durable-idb.store.ts');
const FACADE_TS = path.join(
  FRONTEND,
  'src/app/services/cargar-documentos-json.service.ts'
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadLogic() {
  const mod = await import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
  return mod;
}

function meta(id, overrides = {}) {
  return {
    id,
    title: overrides.title || `Title ${id}`,
    shortTitle: overrides.shortTitle || id,
    kind: 'magisterium',
    locale: 'es',
    bodyPath: overrides.bodyPath || `documents/${id}/content.json`,
    indexPath: overrides.indexPath || `documents/${id}/index.json`,
    unitCount: overrides.unitCount != null ? overrides.unitCount : 2,
    ...overrides,
  };
}

function fixturePack(docs, version = '1.0.0') {
  return {
    version,
    generatedAt: '2026-01-01T00:00:00.000Z',
    documents: docs,
  };
}

function article(consecutivo, contenido) {
  return { consecutivo, contenido, referencias: [] };
}

/**
 * Controlled HTTP layer: records GETs and serves fixtures by URL.
 */
function createHttpLayer(initial) {
  const urls = [];
  const map = new Map(Object.entries(initial || {}));

  return {
    urls,
    set(url, value) {
      map.set(url, value);
    },
    remove(url) {
      map.delete(url);
    },
    httpGet: async (url) => {
      urls.push(url);
      if (!map.has(url)) {
        const err = new Error(`HTTP 404 ${url}`);
        err.status = 404;
        throw err;
      }
      return JSON.parse(JSON.stringify(map.get(url)));
    },
    bodyGetsFor(docId) {
      return urls.filter(
        (u) =>
          u.includes(`/documents/${docId}/content.json`) ||
          u.includes(`/documents/${docId}/index.json`)
      );
    },
    resetLog() {
      urls.length = 0;
    },
  };
}

async function main() {
  section('shipped artifacts exist');
  assert.ok(fs.existsSync(LOGIC_TS), 'corpus-load.logic.ts');
  assert.ok(fs.existsSync(SERVICE_TS), 'corpus.service.ts');
  assert.ok(fs.existsSync(IDB_TS), 'corpus-durable-idb.store.ts');
  assert.ok(fs.existsSync(FACADE_TS), 'cargar-documentos-json.service.ts');

  const serviceSrc = fs.readFileSync(SERVICE_TS, 'utf8');
  assert.ok(
    serviceSrc.includes('CorpusLoadEngine'),
    'CorpusService wires CorpusLoadEngine'
  );
  assert.ok(
    serviceSrc.includes('corpus-load.logic'),
    'CorpusService imports shipped pure load module'
  );
  assert.ok(
    serviceSrc.includes('IndexedDbCorpusStore'),
    'CorpusService uses IndexedDbCorpusStore durable seam'
  );

  const idbSrc = fs.readFileSync(IDB_TS, 'utf8');
  assert.ok(idbSrc.includes('indexedDB'), 'IDB store uses indexedDB API');
  assert.ok(idbSrc.includes('dv-corpus-v1'), 'stable IDB database name');

  const facadeSrc = fs.readFileSync(FACADE_TS, 'utf8');
  assert.ok(
    facadeSrc.includes('ensureLoaded') && facadeSrc.includes('ensureAllLoaded'),
    'facade still exposes ensureLoaded / ensureAllLoaded'
  );
  assert.ok(
    facadeSrc.includes('this.corpus.ensureLoaded'),
    'ensureAllLoaded path goes through corpus.ensureLoaded (durable hit path)'
  );

  const {
    MemoryCorpusStore,
    documentFingerprint,
    isStoredDocumentValid,
    toStoredManifest,
    CorpusLoadEngine,
    MANIFEST_URL,
    CORPUS_ROOT,
  } = await loadLogic();

  section('fingerprint / validity helpers (shipped)');
  const m1 = meta('dv-es', { unitCount: 25 });
  const fp1 = documentFingerprint(m1);
  assert.strictEqual(
    fp1,
    'dv-es|documents/dv-es/content.json|documents/dv-es/index.json|25'
  );
  const m1b = meta('dv-es', { unitCount: 26 });
  assert.notStrictEqual(documentFingerprint(m1b), fp1);
  assert.strictEqual(
    isStoredDocumentValid(
      {
        documentId: 'dv-es',
        fingerprint: fp1,
        meta: m1,
        documento: [article('1', 'hi')],
        indice: { indice: {}, indice_por_punto: {} },
        savedAt: 1,
      },
      m1
    ),
    true
  );
  assert.strictEqual(
    isStoredDocumentValid(
      {
        documentId: 'dv-es',
        fingerprint: fp1,
        meta: m1,
        documento: [article('1', 'hi')],
        indice: { indice: {}, indice_por_punto: {} },
        savedAt: 1,
      },
      m1b
    ),
    false,
    'unitCount change invalidates stored doc'
  );
  assert.strictEqual(isStoredDocumentValid(null, m1), false);

  const storedMan = toStoredManifest(fixturePack([m1], '2.0.0'));
  assert.strictEqual(storedMan.version, '2.0.0');
  assert.strictEqual(storedMan.documents.length, 1);

  // --- Real load path scenarios ---
  const docA = meta('doc-a', { unitCount: 2 });
  const docB = meta('doc-b', { unitCount: 3 });
  const bodyA = [article('1', 'alpha one'), article('2', 'alpha two')];
  const bodyB = [
    article('1', 'beta one'),
    article('2', 'beta two'),
    article('3', 'beta three'),
  ];
  const indexA = { indice: { alpha: [0] }, indice_por_punto: { 0: 1 } };
  const indexB = { indice: { beta: [0] }, indice_por_punto: { 0: 1 } };

  const packV1 = fixturePack([docA, docB], '1.0.0');

  section('(a) first load records body/index/manifest into durable storage');
  const store = new MemoryCorpusStore();
  const http = createHttpLayer({
    [MANIFEST_URL]: packV1,
    [`${CORPUS_ROOT}/documents/doc-a/content.json`]: bodyA,
    [`${CORPUS_ROOT}/documents/doc-a/index.json`]: indexA,
    [`${CORPUS_ROOT}/documents/doc-b/content.json`]: bodyB,
    [`${CORPUS_ROOT}/documents/doc-b/index.json`]: indexB,
  });

  let engine = new CorpusLoadEngine({
    httpGet: http.httpGet,
    store,
  });

  const metas = await engine.loadManifest();
  assert.strictEqual(metas.length, 2);
  assert.ok(await store.getManifest(), 'manifest written to store');
  assert.strictEqual((await store.getManifest()).version, '1.0.0');

  const loadedA = await engine.ensureLoaded('doc-a');
  assert.strictEqual(loadedA.meta.id, 'doc-a');
  assert.strictEqual(loadedA.documento.length, 2);
  assert.strictEqual(loadedA.documento[0].index_array, 0);
  assert.strictEqual(loadedA.documento[0].contenido, 'alpha one');
  assert.deepStrictEqual(loadedA.indice.indice, { alpha: [0] });

  const storedA = await store.getDocument('doc-a');
  assert.ok(storedA, 'document body/index written to durable store');
  assert.strictEqual(storedA.fingerprint, documentFingerprint(docA));
  assert.strictEqual(storedA.documento[0].contenido, 'alpha one');

  const firstBodyGets = http.bodyGetsFor('doc-a').length;
  assert.ok(firstBodyGets >= 2, 'first load HTTP-fetched body+index');
  console.log('  first-load HTTP urls:', http.urls.join(', '));
  console.log('  durable docs:', store.size());

  section('(b) second load after clearMemory (restart) → durable hit, zero body/index HTTP');
  http.resetLog();
  engine.clearMemory();
  assert.strictEqual(engine.hasManifestInMemory(), false);
  assert.strictEqual(engine.getLoaded('doc-a'), undefined);

  // New engine instance sharing the same durable store (true app restart).
  engine = new CorpusLoadEngine({
    httpGet: http.httpGet,
    store,
  });

  const loadedA2 = await engine.ensureLoaded('doc-a');
  assert.strictEqual(loadedA2.documento[0].contenido, 'alpha one');
  assert.strictEqual(loadedA2.meta.id, 'doc-a');
  assert.strictEqual(loadedA2.documento[1].index_array, 1);

  const bodyGetsAfterRestart = http.bodyGetsFor('doc-a');
  assert.strictEqual(
    bodyGetsAfterRestart.length,
    0,
    `expected zero body/index GETs for doc-a after restart, got: ${bodyGetsAfterRestart.join(', ')}`
  );
  assert.ok(
    http.urls.includes(MANIFEST_URL),
    'manifest still refreshed from network when available'
  );
  console.log('  post-restart HTTP urls:', http.urls.join(', ') || '(none)');
  console.log('  body/index GETs for doc-a:', bodyGetsAfterRestart.length);

  section('(c) unchanged doc not re-fetched; new/stale doc is fetched');
  http.resetLog();
  engine.clearMemory();
  engine = new CorpusLoadEngine({ httpGet: http.httpGet, store });
  await engine.ensureLoaded('doc-b');
  assert.ok(http.bodyGetsFor('doc-b').length >= 2, 'new doc-b fetched');
  assert.ok(await store.getDocument('doc-b'));

  // Restart again: both A and B from durable, no body HTTP
  http.resetLog();
  engine.clearMemory();
  engine = new CorpusLoadEngine({ httpGet: http.httpGet, store });
  const all = await engine.ensureAllLoaded();
  assert.strictEqual(all.length, 2);
  assert.strictEqual(
    http.bodyGetsFor('doc-a').length + http.bodyGetsFor('doc-b').length,
    0,
    'ensureAllLoaded uses durable hits for both docs'
  );
  console.log('  ensureAllLoaded HTTP after warm store:', http.urls.join(', '));

  // Stale: unitCount change for doc-a → re-fetch only doc-a
  const docAStale = meta('doc-a', { unitCount: 99 });
  const bodyANew = [article('1', 'alpha NEW'), article('2', 'alpha two')];
  const packV2 = fixturePack([docAStale, docB], '1.0.1');
  http.set(MANIFEST_URL, packV2);
  http.set(`${CORPUS_ROOT}/documents/doc-a/content.json`, bodyANew);

  http.resetLog();
  engine.clearMemory();
  engine = new CorpusLoadEngine({ httpGet: http.httpGet, store });

  const reloadedA = await engine.ensureLoaded('doc-a');
  assert.strictEqual(reloadedA.documento[0].contenido, 'alpha NEW');
  assert.ok(
    http.bodyGetsFor('doc-a').length >= 2,
    'stale fingerprint forces HTTP for doc-a'
  );

  http.resetLog();
  const reloadedB = await engine.ensureLoaded('doc-b');
  assert.strictEqual(reloadedB.documento[0].contenido, 'beta one');
  assert.strictEqual(
    http.bodyGetsFor('doc-b').length,
    0,
    'unchanged doc-b not re-fetched when only doc-a changed'
  );
  console.log(
    '  after stale doc-a, doc-b body GETs:',
    http.bodyGetsFor('doc-b').length
  );

  // Brand-new document in manifest
  const docC = meta('doc-c', { unitCount: 1 });
  const bodyC = [article('1', 'gamma')];
  const indexC = { indice: { gamma: [0] }, indice_por_punto: {} };
  const packV3 = fixturePack([docAStale, docB, docC], '1.1.0');
  http.set(MANIFEST_URL, packV3);
  http.set(`${CORPUS_ROOT}/documents/doc-c/content.json`, bodyC);
  http.set(`${CORPUS_ROOT}/documents/doc-c/index.json`, indexC);

  http.resetLog();
  engine.clearMemory();
  engine = new CorpusLoadEngine({ httpGet: http.httpGet, store });
  const loadedC = await engine.ensureLoaded('doc-c');
  assert.strictEqual(loadedC.documento[0].contenido, 'gamma');
  assert.ok(http.bodyGetsFor('doc-c').length >= 2, 'new doc-c fetched');
  assert.strictEqual(
    http.bodyGetsFor('doc-b').length,
    0,
    'existing doc-b still not re-fetched when loading new doc-c'
  );

  section('offline fallback from durable store');
  const offlineHttp = createHttpLayer({});
  engine.clearMemory();
  engine = new CorpusLoadEngine({
    httpGet: offlineHttp.httpGet,
    store,
  });
  const offlineMetas = await engine.loadManifest();
  assert.ok(offlineMetas.length >= 2, 'manifest from durable offline');
  const offlineA = await engine.ensureLoaded('doc-a');
  assert.strictEqual(offlineA.documento[0].contenido, 'alpha NEW');
  assert.strictEqual(
    offlineHttp.bodyGetsFor('doc-a').length,
    0,
    'offline ensureLoaded does not need body HTTP when durable has doc'
  );
  console.log('  offline load ok; durable docs:', store.size());

  section('summary');
  console.log('All corpus persistence scenarios passed.');
}

main().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
