/**
 * Verificación exhaustiva acotada de planThemeMerges / themeMergeAction.
 * Importa el TypeScript real (no un modelo a mano).
 *
 * Desde la raíz del repo:
 *   bash scripts/node-strip-types.sh \
 *     .cursor/skills/verify-documentos-vaticanos-theme-merge/scripts/verify-theme-merge-identity.js
 *
 * Salida 0 = todas las propiedades pasan dentro del bound.
 * Salida 1 = contraejemplo (bug o rotura scratch).
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const OWNER = 'user-1';
const OTHER = 'user-2';
/** Alfabeto de ids del bound. */
const IDS = ['d1', 'd2', 's1'];
/** Longitud máxima del lote entrante. */
const MAX_INCOMING = 2;
/** Máximo de filas propias en la nube. */
const MAX_OWNED = 2;

function subsets(items, maxSize) {
  const out = [[]];
  for (let n = 1; n <= maxSize; n++) {
    const choose = (start, acc) => {
      if (acc.length === n) {
        out.push([...acc]);
        return;
      }
      for (let i = start; i < items.length; i++) {
        acc.push(items[i]);
        choose(i + 1, acc);
        acc.pop();
      }
    };
    choose(0, []);
  }
  return out;
}

function incomingChoices() {
  // null = id ausente / vacío → mint en themeMergeAction
  return [null, ...IDS];
}

function occupantFor(incomingId) {
  if (incomingId == null) return [null];
  return [
    null,
    { id: incomingId, ownerId: OWNER },
    { id: incomingId, ownerId: OTHER },
  ];
}

/**
 * Solo casos que POST /sync/merge puede armar en sync.ts:
 * - occupied by owner ⇒ id ∈ ownedIds
 * - occupied by other / null occupant ⇒ id ∉ ownedIds
 * - ownedIds son filas de este dueño (pueden quedar sin nombrar)
 */
function reachable(incomingIds, ownedIds, occupants) {
  for (let i = 0; i < incomingIds.length; i++) {
    const id = incomingIds[i];
    const occ = occupants[i];
    if (!id) {
      if (occ != null) return false;
      continue;
    }
    if (occ == null) {
      if (ownedIds.includes(id)) return false;
      continue;
    }
    if (occ.id !== id) return false;
    if (occ.ownerId === OWNER) {
      if (!ownedIds.includes(id)) return false;
    } else if (occ.ownerId === OTHER) {
      if (ownedIds.includes(id)) return false;
    } else {
      return false;
    }
  }
  return true;
}

function* allCases() {
  const ownedList = subsets(IDS, MAX_OWNED);
  for (let n = 0; n <= MAX_INCOMING; n++) {
    const slots = Array.from({ length: n }, () => incomingChoices());
    function* product(i, acc) {
      if (i === n) {
        yield [...acc];
        return;
      }
      for (const v of slots[i]) {
        acc.push(v);
        yield* product(i + 1, acc);
        acc.pop();
      }
    }
    for (const incomingIds of product(0, [])) {
      const occOptions = incomingIds.map(occupantFor);
      function* occProduct(i, acc) {
        if (i === n) {
          yield [...acc];
          return;
        }
        for (const o of occOptions[i]) {
          acc.push(o);
          yield* occProduct(i + 1, acc);
          acc.pop();
        }
      }
      for (const occupants of occProduct(0, [])) {
        for (const ownedIds of ownedList) {
          if (!reachable(incomingIds, ownedIds, occupants)) continue;
          yield { incomingIds, ownedIds, occupants };
        }
      }
    }
  }
}

function formatCase(c, actions) {
  return JSON.stringify({
    incomingIds: c.incomingIds,
    ownedIds: c.ownedIds,
    occupants: c.occupants,
    actions,
  });
}

async function main() {
  const logicPath = path.resolve(
    __dirname,
    '../../../../backend/src/routes/sync-theme.logic.ts',
  );
  const {
    themeMergeAction,
    planThemeMerges,
    signedCreateThenMerge,
    themeDeviceId,
  } = await import(pathToFileURL(logicPath).href);

  let checked = 0;

  // ── themeMergeAction: todo id × ocupante ─────────────────────────
  for (const id of [null, '', ...IDS]) {
    for (const occ of [
      null,
      ...(id ? [{ id, ownerId: OWNER }, { id, ownerId: OTHER }] : []),
      { id: 'other-id', ownerId: OWNER },
    ]) {
      const action = themeMergeAction(id, occ, OWNER);
      checked += 1;

      // P-steal-single: update solo si el ocupante es el dueño y el id coincide.
      if (action.action === 'update') {
        assert.ok(
          occ && occ.id === action.id && occ.ownerId === OWNER,
          `themeMergeAction update sin dueño: id=${id} occ=${JSON.stringify(occ)} → ${JSON.stringify(action)}`,
        );
      }

      // P-foreign: id ocupado por otro → mint, nunca create con ese id.
      if (occ && id && occ.id === id && occ.ownerId !== OWNER) {
        assert.deepStrictEqual(
          action,
          { action: 'mint' },
          `id ajeno debió mint: ${JSON.stringify({ id, occ, action })}`,
        );
      }

      // P-create-id: create conserva el id entrante.
      if (action.action === 'create') {
        assert.strictEqual(action.id, id);
      }

      // P-empty: sin id → mint.
      if (!id) {
        assert.deepStrictEqual(action, { action: 'mint' });
      }
    }
  }

  // ── planThemeMerges: producto del bound ──────────────────────────
  for (const c of allCases()) {
    const actions = planThemeMerges(OWNER, c.incomingIds, c.ownedIds, c.occupants);
    checked += 1;

    assert.strictEqual(
      actions.length,
      c.incomingIds.length,
      `largo del plan: ${formatCase(c, actions)}`,
    );

    const named = new Set(
      c.incomingIds.filter((id) => typeof id === 'string' && id.length > 0),
    );
    const unclaimed = c.ownedIds.filter((id) => !named.has(id));

    // Acciones base (sin el reenganche de lote) para saber qué insertaría.
    const base = c.incomingIds.map((incomingId, index) =>
      themeMergeAction(incomingId, c.occupants[index] ?? null, OWNER),
    );
    const insertAt = base.flatMap((action, index) =>
      action.action === 'create' || action.action === 'mint' ? [index] : [],
    );
    const shouldReattach = insertAt.length === 1 && unclaimed.length === 1;

    // P1 No robar: todo update apunta a un id propio.
    for (const action of actions) {
      if (action.action === 'update') {
        assert.ok(
          c.ownedIds.includes(action.id),
          `P1 update a id no propio: ${formatCase(c, actions)}`,
        );
      }
    }

    // P2 Reenganche único (hotspot 4): una alta + una fila sin nombrar → update de esa fila.
    if (shouldReattach) {
      const idx = insertAt[0];
      assert.deepStrictEqual(
        actions[idx],
        { action: 'update', id: unclaimed[0] },
        `P2 reenganche falló: ${formatCase(c, actions)} (esperado update ${unclaimed[0]})`,
      );
    } else {
      // Sin reenganche, el plan coincide con las acciones base.
      assert.deepStrictEqual(
        actions,
        base,
        `sin reenganche el plan debió igualar themeMergeAction: ${formatCase(c, actions)}`,
      );
    }

    // P3 create conserva el id entrante (cuando no hubo reenganche a update).
    actions.forEach((action, index) => {
      if (action.action === 'create') {
        assert.strictEqual(
          action.id,
          c.incomingIds[index],
          `P3 create id distinto del entrante: ${formatCase(c, actions)}`,
        );
      }
    });

    // P4 dueño con ocupante propio: ese índice es update del mismo id
    //    (el reenganche no aplica a índices que ya eran update).
    c.incomingIds.forEach((incomingId, index) => {
      const occ = c.occupants[index];
      if (
        incomingId &&
        occ &&
        occ.id === incomingId &&
        occ.ownerId === OWNER
      ) {
        assert.deepStrictEqual(
          actions[index],
          { action: 'update', id: incomingId },
          `P4 dueño propio no actualizó: ${formatCase(c, actions)}`,
        );
      }
    });

    // P5 id ajeno sin reenganche: mint (nunca create del id ajeno).
    if (!shouldReattach) {
      c.incomingIds.forEach((incomingId, index) => {
        const occ = c.occupants[index];
        if (
          incomingId &&
          occ &&
          occ.id === incomingId &&
          occ.ownerId !== OWNER
        ) {
          assert.deepStrictEqual(
            actions[index],
            { action: 'mint' },
            `P5 id ajeno debió mint: ${formatCase(c, actions)}`,
          );
        }
      });
    }
  }

  // ── Protocolo alta firmada → merge (signedCreateThenMerge) ───────
  for (const deviceId of IDS) {
    const round = signedCreateThenMerge(deviceId, OWNER);
    assert.strictEqual(round.cloudId, deviceId);
    assert.deepStrictEqual(round.merge, { action: 'update', id: deviceId });
    checked += 1;
  }

  // themeDeviceId: vacío / no string → null
  assert.strictEqual(themeDeviceId(undefined), null);
  assert.strictEqual(themeDeviceId(''), null);
  assert.strictEqual(themeDeviceId('  '), null);
  assert.strictEqual(themeDeviceId(' d1 '), 'd1');

  console.log(
    JSON.stringify({
      ok: true,
      checked,
      bounds: {
        ids: IDS,
        maxIncoming: MAX_INCOMING,
        maxOwned: MAX_OWNED,
        owner: OWNER,
      },
      properties: [
        'P1-no-steal',
        'P2-reattach-single',
        'P3-create-keeps-incoming-id',
        'P4-owner-occupant-updates',
        'P5-foreign-mints-without-reattach',
        'signedCreateThenMerge-roundtrip',
      ],
    }),
  );
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
