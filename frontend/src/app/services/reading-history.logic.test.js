/**
 * Offline reading history: newest document first, position kept, clearable.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/services/reading-history.logic.test.js
 * The list lives next to the cite (`frontend/src/app/core/reading/cite.ts`).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function memoryStore(initial) {
  const data = { ...(initial || {}) };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

async function main() {
  const H = await import(
    pathToFileURL(path.join(__dirname, '../core/reading/cite.ts')).href
  );

  const t0 = '2026-11-17T12:00:00.000Z';
  const t1 = '2026-11-17T12:05:00.000Z';
  const t2 = '2026-11-17T12:09:00.000Z';

  let list = H.recordReading(
    [],
    { documentId: 'cic-es', title: 'Catecismo', unitIndex: 2, unitCount: 10 },
    t0,
  );
  list = H.recordReading(
    list,
    { documentId: 'lg-es', title: 'Lumen gentium', unitIndex: 1, unitCount: 69, label: 'LG 1' },
    t1,
  );
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].documentId, 'lg-es');
  assert.strictEqual(list[0].unitIndex, 1);
  assert.strictEqual(list[0].label, 'LG 1');
  assert.strictEqual(list[0].openedAt, t1);
  assert.strictEqual(list[1].documentId, 'cic-es');
  assert.strictEqual(list[1].unitIndex, 2);

  list = H.recordReading(
    list,
    { documentId: 'cic-es', title: 'Catecismo', unitIndex: 4, unitCount: 10 },
    t2,
  );
  assert.strictEqual(list[0].documentId, 'cic-es');
  assert.strictEqual(list[0].unitIndex, 4);
  assert.strictEqual(list[0].openedAt, t0);
  assert.strictEqual(list[0].updatedAt, t2);
  assert.strictEqual(list[1].documentId, 'lg-es');

  const same = H.recordReading(
    list,
    { documentId: 'no es un id', title: 'x', unitIndex: 0, unitCount: 1 },
    t2,
  );
  assert.strictEqual(same.length, 2);
  assert.strictEqual(same[0].documentId, 'cic-es');

  const junk = H.parseReadingHistory('not-json');
  assert.deepStrictEqual(junk, []);
  const mixed = H.parseReadingHistory(
    JSON.stringify([
      { documentId: 'cic-es', title: 'Catecismo', unitIndex: 2, unitCount: 10, openedAt: t0, updatedAt: t0 },
      { documentId: 'titulo largo', unitIndex: 1 },
      { documentId: 'cic-es', title: 'otra', unitIndex: 9, unitCount: 1, openedAt: t1, updatedAt: t1 },
    ]),
  );
  assert.strictEqual(mixed.length, 1);
  assert.strictEqual(mixed[0].documentId, 'cic-es');
  assert.strictEqual(mixed[0].unitIndex, 2);

  let capped = [];
  for (let i = 0; i < H.READING_HISTORY_CAP + 5; i += 1) {
    capped = H.recordReading(
      capped,
      { documentId: `doc${i}-es`, title: `D${i}`, unitIndex: i, unitCount: i + 1 },
      `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`,
    );
  }
  assert.strictEqual(capped.length, H.READING_HISTORY_CAP);
  assert.strictEqual(capped[0].documentId, `doc${H.READING_HISTORY_CAP + 4}-es`);
  assert.ok(!capped.some((row) => row.documentId === 'doc0-es'));

  const store = memoryStore();
  H.recordReadingInStore(
    store,
    { documentId: 'cic-es', title: 'Catecismo', unitIndex: 2, unitCount: 3 },
    () => t0,
  );
  H.recordReadingInStore(
    store,
    { documentId: 'lg-es', title: 'Lumen gentium', unitIndex: 1, unitCount: 3 },
    () => t1,
  );
  const stored = H.readReadingHistory(store);
  assert.strictEqual(stored[0].documentId, 'lg-es');
  assert.strictEqual(stored[1].unitIndex, 2);
  H.clearReadingHistory(store);
  assert.deepStrictEqual(H.readReadingHistory(store), []);
  assert.strictEqual(store.getItem(H.READING_HISTORY_KEY), null);

  const nav = fs.readFileSync(path.join(__dirname, 'navigation.service.ts'), 'utf8');
  assert.ok(
    nav.includes('recordReadingInStore'),
    'noteVisible must record history in the same local store',
  );
  const visible = nav.slice(nav.indexOf('noteVisible('));
  assert.ok(visible.includes('recordReadingInStore'), 'record happens inside noteVisible');

  console.log('OK: reading-history.logic.test.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
