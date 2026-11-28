/**
 * Cierre por gesto de la hoja: arrastrar hacia abajo la cierra; el scroll
 * interno del texto, cuando no está arriba, se queda con el gesto.
 *
 *   bash ../scripts/node-strip-types.sh src/app/components/dv-sheet/sheet-dismiss.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function load() {
  return import(pathToFileURL(path.join(HERE, 'sheet-dismiss.logic.ts')).href);
}

function replay(mod, origin, frames) {
  let state = mod.sheetGestureBegin({
    pointerId: 1,
    x: 0,
    y: 0,
    time: 0,
    scrollTop: origin.scrollTop,
    fromGrab: !!origin.fromGrab,
    fromField: !!origin.fromField,
  });
  if (!state) return { began: false, end: null, state: null };
  for (const frame of frames) {
    state = mod.sheetGestureMove(state, { x: frame.x, y: frame.y });
  }
  const last = frames[frames.length - 1];
  return {
    began: true,
    state,
    end: mod.sheetGestureEnd(state, last ? last.time : 0),
  };
}

async function main() {
  const mod = await load();

  section('hacia abajo con el texto arriba cierra la hoja');
  const close = replay(
    mod,
    { scrollTop: 0 },
    [
      { x: 0, y: 16, time: 40 },
      { x: 2, y: 140, time: 280 },
    ],
  );
  assert.strictEqual(close.state.phase, 'drag');
  assert.ok(close.state.y >= 80);
  assert.strictEqual(close.end.close, true);
  assert.strictEqual(close.end.blockClick, true);

  section('un arrastre corto no cierra');
  const stay = replay(mod, { scrollTop: null }, [{ x: 0, y: 36, time: 400 }]);
  assert.strictEqual(stay.state.phase, 'drag');
  assert.strictEqual(stay.end.close, false);
  assert.strictEqual(stay.end.spring, true);

  section('un latigazo corto sí cierra');
  const flick = replay(mod, { scrollTop: null }, [{ x: 0, y: 40, time: 40 }]);
  assert.strictEqual(flick.end.close, true);

  section('el texto desplazado se queda el gesto');
  const scrolled = replay(
    mod,
    { scrollTop: 48 },
    [
      { x: 0, y: 24, time: 30 },
      { x: 0, y: 180, time: 200 },
    ],
  );
  assert.strictEqual(scrolled.state.phase, 'scroll');
  assert.strictEqual(scrolled.end.close, false);
  assert.strictEqual(scrolled.end.blockClick, false);

  section('hacia arriba no arrastra la hoja');
  const up = replay(mod, { scrollTop: 0 }, [{ x: 0, y: -80, time: 120 }]);
  assert.strictEqual(up.state.phase, 'scroll');
  assert.strictEqual(up.end.close, false);

  section('el asa cierra aunque el texto esté desplazado');
  const grab = replay(
    mod,
    { scrollTop: 200, fromGrab: true },
    [{ x: 0, y: 120, time: 200 }],
  );
  assert.strictEqual(grab.state.phase, 'drag');
  assert.strictEqual(grab.state.scrollTop, null);
  assert.strictEqual(grab.end.close, true);

  section('un campo de texto no inicia el gesto');
  const field = mod.sheetGestureBegin({
    pointerId: 1,
    x: 0,
    y: 0,
    time: 0,
    scrollTop: 0,
    fromGrab: false,
    fromField: true,
  });
  assert.strictEqual(field, null);

  section('un toque no cierra');
  const tap = replay(mod, { scrollTop: 0 }, [{ x: 2, y: 3, time: 80 }]);
  assert.strictEqual(tap.state.phase, 'pending');
  assert.strictEqual(tap.end.close, false);
  assert.strictEqual(tap.end.blockClick, false);

  section('la hoja escucha el gesto y conserva los otros cierres');
  const src = fs.readFileSync(path.join(HERE, 'dv-sheet.component.ts'), 'utf8');
  assert.ok(src.includes('sheetGestureBegin'));
  assert.ok(src.includes('sheetGestureMove'));
  assert.ok(src.includes('sheetGestureEnd'));
  assert.ok(src.includes('class="grab-hit"'));
  assert.ok(src.includes('(pointerdown)="onSheetDown($event)"'));
  assert.ok(src.includes('(click)="closed.emit()"'));
  assert.ok(src.includes('this.back.register'));
  assert.ok(src.includes('var(--safe-area-inset-bottom)'));
  assert.ok(!src.includes('onGrabDown'));

  console.log('\nsheet-dismiss.logic.test.js ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
