/**
 * Static checks for Papas UI wiring (routes, templates, nav, ficha).
 * Run: node papacy_ui_wiring.test.js
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
  const routing = read('pages/pages-routing.module.ts');
  assert.ok(/path:\s*['"]papas['"]/.test(routing), 'route /papas missing');
  assert.ok(/path:\s*['"]papas\/:id['"]/.test(routing), 'route /papas/:id missing');
  assert.ok(/PapasComponent/.test(routing));
  assert.ok(/PapaDetalleComponent/.test(routing));

  const list = read('pages/papas/papas.component.ts');
  assert.ok(/selector:\s*['"]app-papas['"]/.test(list));
  assert.ok(/PapacyService/.test(list));

  const listHtml = read('pages/papas/papas.component.html');
  assert.ok(/app-era-list/.test(listHtml));
  assert.ok(/vatican\.va/.test(listHtml));

  const det = read('pages/papa-detalle/papa-detalle.component.ts');
  assert.ok(/selector:\s*['"]app-papa-detalle['"]/.test(det));
  assert.ok(/openReading/.test(det), 'ficha opens lector');
  assert.ok(/autoNarr/.test(det), 'narrator CTA');

  const detHtml = read('pages/papa-detalle/papa-detalle.component.html');
  assert.ok(/app-person-ficha/.test(detHtml));
  assert.ok(/app-reading-ctas/.test(detHtml), 'reading CTAs §2.4');
  assert.ok(/santoral/.test(detHtml), 'link to santoral');
  assert.ok(/documentId/.test(detHtml) || /works/.test(detHtml));

  const wbar = read('components/wbar/wbar.component.ts');
  assert.ok(/routerLink="\/papas"/.test(wbar));
  assert.ok(/nav\.popes/.test(wbar));
  assert.ok(/'papas'/.test(wbar));

  const bnav = read('components/bnav/bnav.component.ts');
  assert.ok(/\/papas/.test(bnav));

  const cargar = read('services/cargar-documentos-json.service.ts');
  assert.ok(/PapacyService/.test(cargar));
  assert.ok(/isReadingDocumentId/.test(cargar));

  const units = read('core/santoral/santoral-units.logic.ts');
  assert.ok(/papacy:/.test(units));
  assert.ok(/\/papas/.test(units));

  const cover = read('pages/documento-detalle/documento-detalle.component.html');
  assert.ok(/relatedPope/.test(cover));

  console.log('OK papacy UI wiring');
}

main();
