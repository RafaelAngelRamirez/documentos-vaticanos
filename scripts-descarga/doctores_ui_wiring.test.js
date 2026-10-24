/**
 * Static checks for Doctores UI wiring (routes, templates, nav).
 *
 * Run: node scripts-descarga/doctores_ui_wiring.test.js
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
  assert.ok(/path:\s*['"]doctores['"]/.test(routing), 'route /doctores missing');
  assert.ok(
    /path:\s*['"]doctores\/:id['"]/.test(routing),
    'route /doctores/:id missing',
  );
  assert.ok(/DoctoresComponent/.test(routing));
  assert.ok(/DoctorDetalleComponent/.test(routing));

  const list = read('pages/doctores/doctores.component.ts');
  assert.ok(/selector:\s*['"]app-doctores['"]/.test(list));
  assert.ok(/doctoresByEra/.test(list));

  const listHtml = read('pages/doctores/doctores.component.html');
  assert.ok(/Doctores de la Iglesia/.test(listHtml));
  assert.ok(/routerLink="\/padres"/.test(listHtml) || /routerLink='\/padres'/.test(listHtml));

  const det = read('pages/doctor-detalle/doctor-detalle.component.ts');
  assert.ok(/selector:\s*['"]app-doctor-detalle['"]/.test(det));
  assert.ok(/doctorById/.test(det));

  const detHtml = read('pages/doctor-detalle/doctor-detalle.component.html');
  assert.ok(
    /routerLink\]=\s*\[['"]\/documento['"]/.test(detHtml) ||
      /routerLink\]=\s*\["\/documento"/.test(detHtml) ||
      /\['\/documento', docId\]/.test(detHtml) ||
      /\/documento/.test(detHtml),
    'detail must link works to /documento/:id',
  );
  assert.ok(/próximamente|proximamente/i.test(detHtml), 'pending label');
  assert.ok(/w\.documentId/.test(detHtml) || /documentId as docId/.test(detHtml));

  const wbar = read('components/wbar/wbar.component.ts');
  assert.ok(/routerLink="\/doctores"/.test(wbar), 'wbar link to /doctores');
  assert.ok(
    /Doctores|nav\.doctors/.test(wbar),
    'wbar labels Doctores section',
  );
  assert.ok(/'doctores'/.test(wbar));

  const bnav = read('components/bnav/bnav.component.ts');
  assert.ok(/\/doctores/.test(bnav), 'bnav treats /doctores as biblioteca section');

  const cuenta = read('pages/cuenta/cuenta.component.html');
  assert.ok(/routerLink="\/doctores"/.test(cuenta), 'cuenta entry to Doctores');

  console.log('OK doctores UI wiring');
}

main();
