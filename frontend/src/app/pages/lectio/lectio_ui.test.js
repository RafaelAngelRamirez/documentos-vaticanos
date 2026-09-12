/**
 * Structural wiring: Lectio divina page + Inicio CTA.
 * Run: node src/app/pages/lectio/lectio_ui.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FE = path.resolve(__dirname, '../..');

function read(rel) {
  const p = path.join(FE, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function main() {
  const html = read('pages/lectio/lectio.component.html');
  const ts = read('pages/lectio/lectio.component.ts');
  const routing = read('pages/pages-routing.module.ts');
  const inicioHtml = read('pages/inicio/inicio.component.html');
  const inicioTs = read('pages/inicio/inicio.component.ts');

  assert.ok(/path:\s*'lectio'/.test(routing), 'route /lectio');
  assert.ok(/data-testid=["']lectio-gospel-read["']/.test(html));
  assert.ok(/data-testid=["']lectio-open-vd["']/.test(html));
  assert.ok(/LECTIO_STEPS/.test(ts));
  assert.ok(/vd-es/.test(ts) || /methodDoc/.test(ts));
  assert.ok(/openReading/.test(ts));
  assert.ok(/PalabraDelDiaService/.test(ts));
  assert.ok(/data-testid=["']inicio-lectio["']/.test(inicioHtml));
  assert.ok(/goLectio/.test(inicioTs + inicioHtml));
  assert.ok(/\/lectio/.test(inicioTs));
  console.log('ok lectio-ui');
}

main();
