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
  assert.ok(idbSrc.includes('docChunks'), 'IDB stores body as unit chunks');

  const facadeSrc = fs.readFileSync(FACADE_TS, 'utf8');
  assert.ok(
    facadeSrc.includes('ensureWindow'),
    'facade exposes ensureWindow for the reader'
  );
  const lectorSrc = fs.readFileSync(
    path.join(FRONTEND, 'src/app/components/lector/lector.component.ts'),
    'utf8'
  );
  assert.ok(
    lectorSrc.includes('ensureWindow'),
    'lector opens a document via ensureWindow, not a full body+index wait'
  );
  assert.ok(
    lectorSrc.includes('hydrate_pray') ||
      fs
        .readFileSync(
          path.join(FRONTEND, 'src/app/components/lector/lector.component.html'),
          'utf8'
        )
        .includes('hydrate_pray'),
    'lector shows hydration/prayer copy on slow first load'
  );
  assert.ok(
    facadeSrc.includes('ensureLoaded') && facadeSrc.includes('ensureAllLoaded'),
    'facade still exposes ensureLoaded / ensureAllLoaded'
  );
  assert.ok(
    facadeSrc.includes('ensureIndex') && facadeSrc.includes('ensureIndexForLocale'),
    'facade exposes ensureIndex progressive APIs (PR2b)'
  );
  assert.ok(
    facadeSrc.includes('this.corpus.ensureLoaded'),
    'ensureAllLoaded path goes through corpus.ensureLoaded (durable hit path)'
  );
  assert.ok(
    serviceSrc.includes('ensureIndex'),
    'CorpusService exposes ensureIndex'
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
    'dv-es|documents/dv-es/content.json|documents/dv-es/index.json|25|'
  );
  const m1Hash = meta('dv-es', { unitCount: 25, contentHash: 'abc123def456' });
  assert.notStrictEqual(
    documentFingerprint(m1Hash),
    fp1,
    'contentHash change must invalidate fingerprint (OCR repair, stable unitCount)'
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

  section('(e) ensureIndex loads index.json only; ensureLoaded reuses index cache');
  {
    const store2 = new MemoryCorpusStore();
    const http2 = createHttpLayer({
      [MANIFEST_URL]: fixturePack(
        [meta('doc-a'), meta('doc-b')],
        'ensure-index',
      ),
      [`${CORPUS_ROOT}/documents/doc-a/content.json`]: [
        article('1', 'alpha one'),
        article('2', 'alpha two'),
      ],
      [`${CORPUS_ROOT}/documents/doc-a/index.json`]: {
        indice: { alpha: [0], one: [0] },
        indice_por_punto: { 0: 1, 1: 2 },
      },
    });
    let eng = new CorpusLoadEngine({
      httpGet: http2.httpGet,
      store: store2,
    });
    const indexed = await eng.ensureIndex('doc-a');
    assert.ok(indexed.indice && indexed.indice.indice);
    assert.strictEqual(indexed.bodyLoaded, false);
    assert.strictEqual(indexed.documento.length, 0);
    assert.ok(
      http2.urls.some((u) => u.endsWith('/doc-a/index.json')),
      'index.json fetched',
    );
    assert.strictEqual(
      http2.urls.filter((u) => u.endsWith('/doc-a/content.json')).length,
      0,
      'content.json must not load on ensureIndex',
    );

    http2.resetLog();
    const full = await eng.ensureLoaded('doc-a');
    assert.strictEqual(full.documento[0].contenido, 'alpha one');
    assert.ok(
      http2.urls.some((u) => u.endsWith('/doc-a/content.json')),
      'body fetched on ensureLoaded',
    );
    assert.strictEqual(
      http2.urls.filter((u) => u.endsWith('/doc-a/index.json')).length,
      0,
      'index not re-fetched when indexCache warm',
    );
    console.log('  ensureIndex → ensureLoaded reuse OK');
  }

  section('(f) ensureWindow skips index.json and does not await durable write');
  {
    const storeW = new MemoryCorpusStore();
    let persistReleased = false;
    let releasePersist;
    const persistGate = new Promise((r) => {
      releasePersist = r;
    });
    const origSet = storeW.setDocument.bind(storeW);
    storeW.setDocument = async (doc) => {
      await persistGate;
      persistReleased = true;
      return origSet(doc);
    };
    const httpW = createHttpLayer({
      [MANIFEST_URL]: fixturePack([meta('doc-a', { unitCount: 2 })], 'win'),
      [`${CORPUS_ROOT}/documents/doc-a/content.json`]: [
        article('1', 'alpha one'),
        article('2', 'alpha two'),
      ],
      [`${CORPUS_ROOT}/documents/doc-a/index.json`]: {
        indice: { alpha: [0] },
        indice_por_punto: {},
      },
    });
    const engW = new CorpusLoadEngine({
      httpGet: httpW.httpGet,
      store: storeW,
    });
    const win = await engW.ensureWindow('doc-a', 0, 5);
    assert.ok(win.documento && win.documento.length, 'non-empty unit window');
    assert.strictEqual(win.documento[0].contenido, 'alpha one');
    assert.strictEqual(
      httpW.urls.filter((u) => u.endsWith('/doc-a/index.json')).length,
      0,
      'reader window must not fetch index.json'
    );
    assert.ok(
      httpW.urls.some((u) => u.endsWith('/doc-a/content.json')),
      'window load fetches content.json'
    );
    assert.strictEqual(
      persistReleased,
      false,
      'first paint must not wait on a full-body durable write'
    );
    releasePersist();
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(persistReleased, true, 'background persist still runs');
    const storedW = await storeW.getDocument('doc-a');
    assert.ok(storedW, 'body persisted in background after window load');
    httpW.resetLog();
    engW.clearMemory();
    const win2 = await engW.ensureWindow('doc-a', 0, 5);
    assert.strictEqual(win2.documento[0].contenido, 'alpha one');
    assert.strictEqual(
      httpW.urls.filter((u) => u.endsWith('/doc-a/content.json')).length,
      0,
      'second window load hits durable store'
    );
    console.log('  ensureWindow skip-index + no-await persist + durable reuse OK');
  }

  section('(g) ensureWindow cold window then fingerprint change forces HTTP');
  {
    const storeG = new MemoryCorpusStore();
    const docV1 = meta('doc-a', { unitCount: 2, contentHash: 'hash-v1' });
    const httpG = createHttpLayer({
      [MANIFEST_URL]: fixturePack([docV1], 'g1'),
      [`${CORPUS_ROOT}/documents/doc-a/content.json`]: [
        article('1', 'alpha one'),
        article('2', 'alpha two'),
      ],
      [`${CORPUS_ROOT}/documents/doc-a/index.json`]: {
        indice: { alpha: [0] },
        indice_por_punto: {},
      },
    });
    let engG = new CorpusLoadEngine({
      httpGet: httpG.httpGet,
      store: storeG,
    });
    const cold = await engG.ensureWindow('doc-a', 0, 5);
    assert.ok(cold.documento.length >= 1, 'cold window non-empty');
    assert.strictEqual(cold.documento[0].contenido, 'alpha one');
    assert.strictEqual(
      httpG.urls.filter((u) => u.endsWith('/doc-a/index.json')).length,
      0,
      'cold ensureWindow must not GET index.json'
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(await storeG.getDocument('doc-a'), 'durable body after cold window');

    const docV2 = meta('doc-a', { unitCount: 2, contentHash: 'hash-v2' });
    httpG.set(MANIFEST_URL, fixturePack([docV2], 'g2'));
    httpG.set(`${CORPUS_ROOT}/documents/doc-a/content.json`, [
      article('1', 'alpha NEW'),
      article('2', 'alpha two'),
    ]);
    httpG.resetLog();
    engG.clearMemory();
    engG = new CorpusLoadEngine({
      httpGet: httpG.httpGet,
      store: storeG,
    });
    const afterHash = await engG.ensureWindow('doc-a', 0, 5);
    assert.strictEqual(
      afterHash.documento[0].contenido,
      'alpha NEW',
      'stale IDB rejected when contentHash changes'
    );
    assert.ok(
      httpG.urls.some((u) => u.endsWith('/doc-a/content.json')),
      'fingerprint change of same id forces HTTP again'
    );
    assert.strictEqual(
      httpG.urls.filter((u) => u.endsWith('/doc-a/index.json')).length,
      0,
      'refetch window still skips index.json'
    );
    console.log('  ensureWindow fingerprint invalidate OK');
  }

  section('(h) ensureWindow does not wait on ensureLoaded inflight (index.json)');
  {
    const storeH = new MemoryCorpusStore();
    let releaseIndex;
    const indexGate = new Promise((r) => {
      releaseIndex = r;
    });
    const httpH = createHttpLayer({
      [MANIFEST_URL]: fixturePack([meta('doc-a', { unitCount: 2 })], 'h'),
      [`${CORPUS_ROOT}/documents/doc-a/content.json`]: [
        article('1', 'alpha one'),
        article('2', 'alpha two'),
      ],
      [`${CORPUS_ROOT}/documents/doc-a/index.json`]: {
        indice: { alpha: [0] },
        indice_por_punto: {},
      },
    });
    const origGet = httpH.httpGet;
    httpH.httpGet = async (url) => {
      if (String(url).endsWith('/doc-a/index.json')) {
        await indexGate;
      }
      return origGet(url);
    };
    const engH = new CorpusLoadEngine({
      httpGet: httpH.httpGet,
      store: storeH,
    });
    const fullP = engH.ensureLoaded('doc-a');
    const win = await engH.ensureWindow('doc-a', 0, 5);
    assert.ok(win.documento && win.documento.length, 'window returned while index blocked');
    assert.strictEqual(win.documento[0].contenido, 'alpha one');
    releaseIndex();
    const full = await fullP;
    assert.ok(full.indice && full.indice.indice && full.indice.indice.alpha);
    console.log('  ensureWindow vs ensureLoaded inflight OK');
  }

  section('summary');
  console.log('All corpus persistence scenarios passed.');
}

main().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
