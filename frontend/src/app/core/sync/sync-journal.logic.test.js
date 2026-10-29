/**
 * Diario append-only dv-sync-v1: HLC, lápida, .dvdelta, merge v3.
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/sync/sync-journal.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'sync-journal.logic.ts')).href
  );
  const {
    SYNC_IDB_NAME,
    DVDELTA_FORMAT,
    DVDELTA_VERSION,
    compareHlc,
    tickHlc,
    receiveHlc,
    createJournalMeta,
    emitOp,
    applyOps,
    emptyApplyState,
    entityKey,
    projectEntities,
    buildDvDelta,
    serializeDvDelta,
    parseDvDelta,
    dvDeltaHasSecrets,
    migrateLocalKeysToOps,
    mergeBackupById,
    opsAboveVector,
    vectorFromOps,
    writeProjectionToStore,
    ANOTACIONES_KEY,
    TEMAS_KEY,
    FAVS_KEY,
  } = mod;

  assert.strictEqual(SYNC_IDB_NAME, 'dv-sync-v1');
  assert.strictEqual(DVDELTA_FORMAT, 'dvdelta');
  assert.strictEqual(DVDELTA_VERSION, 1);

  // ── Reloj híbrido ──────────────────────────────────────────────────
  const peerA = 'peer-a';
  const peerB = 'peer-b';
  let hlcA = { wall: 1000, counter: 0, peerId: peerA };
  hlcA = tickHlc(hlcA, 1000);
  assert.strictEqual(hlcA.wall, 1000);
  assert.strictEqual(hlcA.counter, 1);
  hlcA = tickHlc(hlcA, 900); // reloj atrasado: no baja wall
  assert.strictEqual(hlcA.wall, 1000);
  assert.strictEqual(hlcA.counter, 2);
  hlcA = tickHlc(hlcA, 2000);
  assert.strictEqual(hlcA.wall, 2000);
  assert.strictEqual(hlcA.counter, 0);

  const remote = { wall: 2500, counter: 5, peerId: peerB };
  const afterRecv = receiveHlc(hlcA, remote, 2400);
  assert.strictEqual(afterRecv.wall, 2500);
  assert.strictEqual(afterRecv.counter, 6);
  assert.strictEqual(afterRecv.peerId, peerA);

  assert.ok(compareHlc({ wall: 1, counter: 0, peerId: peerA }, { wall: 2, counter: 0, peerId: peerB }) < 0);
  assert.ok(
    compareHlc(
      { wall: 5, counter: 1, peerId: peerA },
      { wall: 5, counter: 1, peerId: peerB },
    ) < 0,
  );

  // ── Emitir + aplicar + lápida ──────────────────────────────────────
  let meta = createJournalMeta(1000, peerA, 'group-1');
  const noteValor = {
    documentId: 'cic-es',
    unitIndex: 0,
    excerpt: '',
    nota: 'primera',
    kind: 'nota',
    createdAt: 1000,
  };
  let e1 = emitOp(
    { meta, nowWall: 1000 },
    {
      coleccion: 'nota',
      entityId: 'n1',
      tipo: 'poner',
      valor: noteValor,
      ancla: { documentId: 'cic-es', unitIndex: 0, excerpt: '' },
    },
  );
  meta = e1.meta;
  let state = applyOps(emptyApplyState(peerA, 1000), [e1.op], 1000);
  const n1Key = entityKey('nota', 'n1');
  assert.strictEqual(state.entities.get(n1Key).deleted, false);
  assert.deepStrictEqual(state.vector, { [peerA]: 1 });

  // Idempotencia: misma opId no duplica.
  state = applyOps(state, [e1.op], 1001);
  assert.strictEqual(state.seen.size, 1);

  const e2 = emitOp(
    { meta, nowWall: 1100 },
    { coleccion: 'nota', entityId: 'n1', tipo: 'lapida' },
  );
  meta = e2.meta;
  state = applyOps(state, [e2.op], 1100);
  assert.strictEqual(state.entities.get(n1Key).deleted, true);
  let proj = projectEntities(state.entities);
  assert.strictEqual(proj.anotaciones.length, 0);

  // Edición concurrente con reloj menor no revive.
  const staleEdit = {
    ...e1.op,
    opId: `${peerB}:1`,
    peerId: peerB,
    seq: 1,
    hlc: { wall: 1050, counter: 0, peerId: peerB },
    tipo: 'poner',
    valor: { ...noteValor, nota: 'stale' },
  };
  state = applyOps(state, [staleEdit], 1200);
  assert.strictEqual(state.entities.get(n1Key).deleted, true);

  // Edición con reloj mayor que la lápida sí revive.
  const revive = {
    ...e1.op,
    opId: `${peerB}:2`,
    peerId: peerB,
    seq: 2,
    hlc: { wall: 2000, counter: 0, peerId: peerB },
    tipo: 'poner',
    valor: { ...noteValor, nota: 'revivida' },
  };
  state = applyOps(state, [revive], 2000);
  assert.strictEqual(state.entities.get(n1Key).deleted, false);
  proj = projectEntities(state.entities);
  assert.strictEqual(proj.anotaciones.length, 1);
  assert.strictEqual(proj.anotaciones[0].nota, 'revivida');

  // ── Dos temas con el mismo título ──────────────────────────────────
  meta = createJournalMeta(3000, peerA, 'group-1');
  const t1 = emitOp(
    { meta, nowWall: 3000 },
    {
      coleccion: 'tema',
      entityId: 'tema-1',
      tipo: 'poner',
      valor: { title: 'Cuaresma', visibility: 'private' },
    },
  );
  meta = t1.meta;
  const t2 = emitOp(
    { meta, nowWall: 3001 },
    {
      coleccion: 'tema',
      entityId: 'tema-2',
      tipo: 'poner',
      valor: { title: 'Cuaresma', visibility: 'private' },
    },
  );
  meta = t2.meta;
  state = applyOps(emptyApplyState(peerA, 3000), [t1.op, t2.op], 3001);
  proj = projectEntities(state.entities);
  assert.strictEqual(proj.temas.length, 2);
  assert.strictEqual(proj.temas[0].title, 'Cuaresma');
  assert.strictEqual(proj.temas[1].title, 'Cuaresma');

  // ── Favorito y lectura ─────────────────────────────────────────────
  const fav = emitOp(
    { meta, nowWall: 3100 },
    { coleccion: 'favorito', entityId: 'cic-es', tipo: 'poner', valor: 'cic-es' },
  );
  meta = fav.meta;
  const lect = emitOp(
    { meta, nowWall: 3101 },
    {
      coleccion: 'lectura',
      entityId: 'cic-es',
      tipo: 'poner',
      valor: { title: 'CIC', unitIndex: 3, unitCount: 100, label: 'n. 3' },
    },
  );
  meta = lect.meta;
  state = applyOps(state, [fav.op, lect.op], 3101);
  proj = projectEntities(state.entities);
  assert.deepStrictEqual(proj.favoritos, ['cic-es']);
  assert.strictEqual(proj.lecturas.length, 1);
  assert.strictEqual(proj.lecturas[0].unitIndex, 3);

  // Quitar favorito = lápida (no un hueco silencioso).
  const unfav = emitOp(
    { meta, nowWall: 3200 },
    { coleccion: 'favorito', entityId: 'cic-es', tipo: 'lapida' },
  );
  meta = unfav.meta;
  state = applyOps(state, [unfav.op], 3200);
  proj = projectEntities(state.entities);
  assert.deepStrictEqual(proj.favoritos, []);

  // ── .dvdelta sin secretos ──────────────────────────────────────────
  const allOps = [t1.op, t2.op, fav.op, lect.op, unfav.op];
  const delta = buildDvDelta(allOps, 'group-1', '2026-10-27T00:00:00.000Z');
  assert.strictEqual(delta.format, 'dvdelta');
  assert.strictEqual(delta.version, 1);
  assert.strictEqual(delta.groupId, 'group-1');
  assert.ok(!dvDeltaHasSecrets(delta));
  const raw = serializeDvDelta(delta);
  assert.ok(!raw.includes('auth.accessToken'));
  assert.ok(!raw.includes('xaiApiKey'));
  const parsed = parseDvDelta(JSON.parse(raw));
  assert.strictEqual(parsed.ops.length, allOps.length);

  assert.throws(
    () =>
      parseDvDelta({
        format: 'dvdelta',
        version: 1,
        groupId: 'g',
        ops: [{ valor: { 'auth.accessToken': 'tok' } }],
      }),
    /prohibidos|auth\.accessToken/,
  );

  // Vector: solo ops nuevas.
  const above = opsAboveVector(allOps, { [peerA]: 2 });
  assert.ok(above.every((op) => op.seq > 2));
  assert.deepStrictEqual(vectorFromOps(allOps)[peerA], meta.seq);

  // ── Migración desde claves LS ──────────────────────────────────────
  meta = createJournalMeta(5000, 'peer-mig', 'group-mig');
  const migrated = migrateLocalKeysToOps(
    meta,
    {
      anotaciones: [
        {
          id: 'a1',
          documentId: 'cic-es',
          unitIndex: 1,
          excerpt: 'texto',
          kind: 'subrayado',
          createdAt: 4000,
          updatedAt: '2026-10-01T00:00:00.000Z',
        },
        {
          id: 'a2',
          documentId: 'cic-es',
          unitIndex: 1,
          excerpt: '',
          nota: 'hola',
          kind: 'nota',
          createdAt: 4001,
          updatedAt: '2026-10-01T00:00:01.000Z',
        },
      ],
      temas: [
        {
          id: 'th1',
          title: 'Adviento',
          description: null,
          visibility: 'private',
          steps: [
            { id: 's1', order: 0, documentId: 'cic-es', unitIndex: 2 },
          ],
          updatedAt: '2026-10-02T00:00:00.000Z',
        },
      ],
      favoritos: ['lg-es'],
      lastRead: {
        documentId: 'lg-es',
        title: 'LG',
        unitIndex: 5,
        unitCount: 20,
        updatedAt: '2026-10-03T00:00:00.000Z',
      },
    },
    5000,
  );
  assert.ok(migrated.ops.length >= 5);
  state = applyOps(emptyApplyState('peer-mig', 5000), migrated.ops, 5000);
  proj = projectEntities(state.entities);
  assert.strictEqual(proj.anotaciones.length, 2);
  assert.strictEqual(proj.temas.length, 1);
  assert.strictEqual(proj.temas[0].steps.length, 1);
  assert.deepStrictEqual(proj.favoritos, ['lg-es']);
  assert.strictEqual(proj.lecturas[0].documentId, 'lg-es');

  // ── Merge backup v3: no borra ausentes ─────────────────────────────
  const localNotes = [
    { id: 'keep', updatedAt: '2026-01-01T00:00:00.000Z', nota: 'local' },
    { id: 'both', updatedAt: '2026-01-02T00:00:00.000Z', nota: 'vieja' },
  ];
  const fileNotes = [
    { id: 'both', updatedAt: '2026-02-01T00:00:00.000Z', nota: 'nueva' },
    { id: 'only-file', updatedAt: '2026-01-03T00:00:00.000Z', nota: 'file' },
  ];
  const merged = mergeBackupById(localNotes, fileNotes);
  const ids = merged.map((n) => n.id).sort();
  assert.deepStrictEqual(ids, ['both', 'keep', 'only-file']);
  assert.strictEqual(merged.find((n) => n.id === 'both').nota, 'nueva');
  assert.strictEqual(merged.find((n) => n.id === 'keep').nota, 'local');

  // ── Proyección a store ─────────────────────────────────────────────
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };
  writeProjectionToStore(store, proj);
  assert.ok(store.getItem(ANOTACIONES_KEY));
  assert.ok(store.getItem(TEMAS_KEY));
  assert.ok(store.getItem(FAVS_KEY));
  const favs = JSON.parse(store.getItem(FAVS_KEY));
  assert.deepStrictEqual(favs, ['lg-es']);

  console.log('sync-journal.logic.test.js ok');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
