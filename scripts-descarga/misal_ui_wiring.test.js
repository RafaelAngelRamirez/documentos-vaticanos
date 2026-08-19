/**
 * Structural wiring: Inicio lecturas del día (replaces IGMR block).
 *
 * Run: node scripts-descarga/misal_ui_wiring.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const FE = path.join(REPO, 'frontend/src/app');

function read(rel) {
  const p = path.join(FE, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function main() {
  const html = read('pages/inicio/inicio.component.html');
  const ts = read('pages/inicio/inicio.component.ts');
  assert.ok(/data-testid=["']inicio-lecturas["']/.test(html), 'inicio-lecturas');
  assert.ok(
    /inicio.readings_today|lecturasToday/.test(html + ts),
    'lecturas del día title/data',
  );
  assert.ok(
    /inicio-saints-day/.test(html),
    'saints block still present beside lecturas',
  );
  assert.ok(
    !/inicio-misal|También en el calendario|Más en el calendario/.test(html),
    'no IGMR / calendar-hint chrome on inicio',
  );
  assert.ok(
    !/have_account|goCuenta/.test(html),
    'account link hidden on inicio',
  );
  assert.ok(/lecturasForLiturgicalDate/.test(ts), 'liturgical picker');
  assert.ok(/openReading/.test(ts), 'listen/read opens lector');

  const calHtml = read('pages/santoral/santoral.component.html');
  assert.ok(
    !/santoral-cal-misal/.test(calHtml),
    'calendar no longer surfaces IGMR',
  );

  const logic = read('core/liturgia/lecturas-del-dia.logic.ts');
  assert.ok(/lecturasForLiturgicalDate/.test(logic));

  console.log('ok lecturas-ui-wiring');
}

main();
