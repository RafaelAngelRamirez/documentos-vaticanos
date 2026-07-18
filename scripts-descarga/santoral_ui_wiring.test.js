/**
 * Static + structural checks for santoral UI wiring (routes, templates, refs).
 *
 * Run: node scripts-descarga/santoral_ui_wiring.test.js
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
  assert.ok(
    /path:\s*['"]santoral['"]/.test(routing),
    'route /santoral missing',
  );
  assert.ok(
    /path:\s*['"]santoral\/:id['"]/.test(routing),
    'route /santoral/:id missing',
  );
  assert.ok(/SantoralComponent/.test(routing));
  assert.ok(/SantoDetalleComponent/.test(routing));

  const list = read('pages/santoral/santoral.component.ts');
  assert.ok(/selector:\s*['"]app-santoral['"]/.test(list));

  const detail = read('pages/santo-detalle/santo-detalle.component.html');
  assert.ok(
    /routerLink.*documento/.test(detail) || /\['\/documento'/.test(detail),
    'saint detail must link to /documento/:id',
  );
  assert.ok(/Obras en la biblioteca/.test(detail));
  assert.ok(/s\.bio|santo\.bio|\*ngIf="s\.bio"/.test(detail) || /bio/.test(detail));

  const detailTs = read('pages/santo-detalle/santo-detalle.component.ts');
  assert.ok(/worksForSaint|works/.test(detailTs));
  assert.ok(/\/documento/.test(detailTs) || /documento/.test(detail));

  const docHtml = read('pages/documento-detalle/documento-detalle.component.html');
  assert.ok(/relatedSaint|Referencias/.test(docHtml), 'doc cover has Referencias');
  assert.ok(
    /santoral/.test(docHtml),
    'doc cover links to santoral',
  );
  assert.ok(/siblingWorks/.test(docHtml));

  const docTs = read('pages/documento-detalle/documento-detalle.component.ts');
  assert.ok(/SantoralService/.test(docTs));
  assert.ok(/relatedSaint/.test(docTs));

  const wbar = read('components/wbar/wbar.component.ts');
  assert.ok(/santoral/.test(wbar), 'wbar exposes Santoral');

  const service = read('core/santoral/santoral.service.ts');
  assert.ok(/SANTORAL_MANIFEST_URL|assets\/corpus\/santoral/.test(service));

  console.log('ok santoral-ui-wiring');
  console.log(
    JSON.stringify({
      routes: ['/santoral', '/santoral/:id'],
      wbar: true,
      docRefs: true,
      saintDetailDocs: true,
    }),
  );
}

main();
