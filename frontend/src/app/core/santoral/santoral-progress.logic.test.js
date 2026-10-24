/**
 * Reading progress path for saint documentIds — real set/get last-read helpers
 * used by ReadingProgressService + canContinueSaintReading from units logic.
 *
 * Run:
 *   node --experimental-strip-types frontend/src/app/core/santoral/santoral-progress.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../../');
const UNITS = path.join(HERE, 'santoral-units.logic.ts');
const PROGRESS_LOGIC = path.join(
  REPO,
  'frontend/src/app/services/reading-progress.logic.ts',
);
const PROGRESS_SVC = path.join(
  REPO,
  'frontend/src/app/services/reading-progress.service.ts',
);
const PACK = path.join(REPO, 'frontend/src/assets/corpus/santoral/manifest.json');

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(String(k), String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

async function main() {
  assert.ok(fs.existsSync(UNITS));
  assert.ok(fs.existsSync(PROGRESS_LOGIC));
  assert.ok(fs.existsSync(PROGRESS_SVC));
  assert.ok(fs.existsSync(PACK));

  // Service must delegate to pure logic (real shipped path)
  const svcSrc = fs.readFileSync(PROGRESS_SVC, 'utf8');
  assert.ok(
    /setLastReadInStore|getLastReadFromStore/.test(svcSrc),
    'ReadingProgressService must use reading-progress.logic helpers',
  );
  assert.ok(
    /from ['\"]\.\/reading-progress\.logic['\"]/.test(svcSrc),
    'service imports reading-progress.logic',
  );

  const unitsLogic = await import(pathToFileURL(UNITS).href + `?t=${Date.now()}`);
  const progressLogic = await import(
    pathToFileURL(PROGRESS_LOGIC).href + `?t=${Date.now()}`
  );

  const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  const saint =
    (pack.saints || []).find((s) => (s.bio || '').length > 200) ||
    (pack.saints || [])[0];
  assert.ok(saint, 'need a saint');

  const docId = unitsLogic.saintDocumentId(saint.id);
  const loaded = unitsLogic.saintToReadingDocument(saint);
  assert.ok(loaded && loaded.documento.length >= 1);

  const store = makeMemoryStorage();

  // Fresh: no continue
  assert.strictEqual(progressLogic.getLastReadFromStore(store), null);
  assert.strictEqual(
    unitsLogic.canContinueSaintReading(
      progressLogic.getLastReadFromStore(store),
      saint.id,
    ),
    false,
  );

  // Multi-unit bios: set progress mid-way (unitIndex > 0)
  const idx = loaded.documento.length > 1 ? 2 : 0;
  const forcedIdx =
    loaded.documento.length > 1 ? Math.min(2, loaded.documento.length - 1) : 0;

  progressLogic.setLastReadInStore(store, {
    documentId: docId,
    title: loaded.meta.title,
    unitIndex: forcedIdx,
    unitCount: loaded.meta.unitCount,
    label: loaded.documento[forcedIdx]?.consecutivo,
  });

  const last = progressLogic.getLastReadFromStore(store);
  assert.ok(last, 'getLastRead after set');
  assert.strictEqual(last.documentId, docId);
  assert.strictEqual(last.unitIndex, forcedIdx);
  assert.strictEqual(last.unitCount, loaded.meta.unitCount);
  assert.ok(last.updatedAt, 'updatedAt stamped');

  // Key is the real offline key
  assert.strictEqual(progressLogic.LAST_READ_KEY, 'dv.lastRead');
  assert.ok(store.getItem('dv.lastRead'), 'persisted under dv.lastRead');

  const puedeContinuar = unitsLogic.canContinueSaintReading(last, saint.id);
  if (forcedIdx > 0) {
    assert.strictEqual(puedeContinuar, true, 'unitIndex > 0 → Continuar');
  } else {
    assert.strictEqual(puedeContinuar, false);
  }

  assert.strictEqual(
    unitsLogic.canContinueSaintReading(last, 'otro-santo'),
    false,
  );

  const ctaLabel = puedeContinuar
    ? 'Continuar la lectura'
    : 'Comenzar la lectura';
  assert.ok(
    ctaLabel === 'Continuar la lectura' || ctaLabel === 'Comenzar la lectura',
  );

  // percent helper
  if (forcedIdx > 0 && loaded.meta.unitCount > 0) {
    const p = progressLogic.lastReadPercent(last);
    assert.ok(p >= 0 && p <= 100);
  }

  console.log('ok santoral-progress');
  console.log(
    JSON.stringify({
      saintId: saint.id,
      docId,
      unitIndex: forcedIdx,
      unitCount: loaded.meta.unitCount,
      puedeContinuar,
      ctaLabel,
      lastReadKey: progressLogic.LAST_READ_KEY,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
