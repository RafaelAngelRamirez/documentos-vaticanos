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
  assert.ok(
    /calendario|CalendarLevel|yearMonthSummaries/.test(list),
    'santoral list wires calendar mode logic',
  );

  const listHtml = read('pages/santoral/santoral.component.html');
  assert.ok(/Calendario/.test(listHtml), 'calendar mode toggle present');
  assert.ok(
    /data-cal-level=["']anio["']|calLevel === ['"]anio['"]/.test(listHtml),
    'year (año) view markers',
  );
  assert.ok(
    /data-cal-level=["']mes["']|calLevel === ['"]mes['"]/.test(listHtml),
    'month (mes) view markers',
  );
  assert.ok(
    /data-cal-level=["']dia["']|calLevel === ['"]dia['"]/.test(listHtml),
    'day (día) view markers',
  );
  assert.ok(
    /routerLink.*santoral|navigate\(\[\s*['"]\/santoral['"]/.test(listHtml) ||
      /open\(s\)/.test(listHtml),
    'day list navigates to saint detail',
  );
  assert.ok(
    /cal-empty|No hay santos/.test(listHtml),
    'empty day state present',
  );

  const calLogic = read('core/santoral/santoral-calendar.logic.ts');
  assert.ok(/saintsForDay/.test(calLogic));
  assert.ok(/yearMonthSummaries/.test(calLogic));
  assert.ok(/monthDayCells/.test(calLogic));
  assert.ok(/feastDays/.test(calLogic));

  const detail = read('pages/santo-detalle/santo-detalle.component.html');
  assert.ok(
    /routerLink.*documento/.test(detail) || /\['\/documento'/.test(detail),
    'saint detail must link to /documento/:id',
  );
  assert.ok(/Obras en la biblioteca/.test(detail));

  // Reading structure (parity with 2A): CTA + narrador, not flat-only bio
  assert.ok(
    /Comenzar la lectura|ctaLabel|comenzar\(\)/.test(detail),
    'saint cover must expose Comenzar/Continuar reading CTA',
  );
  assert.ok(
    /Escuchar con narrador|comenzarNarrador/.test(detail),
    'saint cover must expose narrator entry',
  );
  assert.ok(/Temas/.test(detail), 'Temas section present');
  assert.ok(
    /openTheme|theme-chip|buscar/.test(detail) ||
      /openTheme/.test(read('pages/santo-detalle/santo-detalle.component.ts')),
    'Temas chips must be operable (search navigation)',
  );
  assert.ok(
    /related-units|Relacionados/.test(detail),
    'Relacionados panel or heading on saint cover',
  );

  const detailTs = read('pages/santo-detalle/santo-detalle.component.ts');
  assert.ok(/worksForSaint|works/.test(detailTs));
  assert.ok(/\/documento/.test(detailTs) || /documento/.test(detail));
  assert.ok(
    /saintDocumentId|readingDocId|ROUTE\.leyendo/.test(detailTs),
    'saint detail navigates into real lector with santoral documentId',
  );
  assert.ok(
    /ReadingProgressService|canContinueSaintReading|puedeContinuar/.test(
      detailTs,
    ),
    'progress / continuar wiring',
  );
  assert.ok(
    /RelatedUnitsPanelComponent|related-units/.test(detailTs) ||
      /related-units/.test(detail),
    'related units panel imported',
  );

  // Units logic + service materialization path
  const unitsLogic = read('core/santoral/santoral-units.logic.ts');
  assert.ok(/bioToReadingUnits/.test(unitsLogic));
  assert.ok(/saintDocumentId|santoral:/.test(unitsLogic));
  assert.ok(/saintToReadingDocument/.test(unitsLogic));
  // Exit path of shared lector: must not land on /documento/santoral:…
  assert.ok(
    /coverPathForDocumentId|coverNavCommandsForDocumentId/.test(unitsLogic),
    'cover helpers for saint vs corpus reading ids',
  );
  assert.ok(
    /parentPathForAppUrl/.test(unitsLogic),
    'parentPathForAppUrl pure hierarchy (BackService source)',
  );
  assert.ok(
    /\/santoral\//.test(unitsLogic) && /parseSaintDocumentId/.test(unitsLogic),
    'saint reading ids resolve cover/parent to /santoral/:id',
  );

  const service = read('core/santoral/santoral.service.ts');
  assert.ok(/SANTORAL_MANIFEST_URL|assets\/corpus\/santoral/.test(service));
  assert.ok(
    /ensureSaintLoaded|ensureSaintAsIndice/.test(service),
    'SantoralService exposes saint document load for lector',
  );

  const cargar = read('services/cargar-documentos-json.service.ts');
  assert.ok(
    /isReadingDocumentId|ensureSaintAsIndice|santoral/.test(cargar),
    'CargarDocumentosJsonService routes santoral:* to saint pack',
  );

  const lector = read('components/lector/lector.component.ts');
  assert.ok(
    /coverNavCommandsForDocumentId/.test(lector),
    'lector goBack uses coverNavCommandsForDocumentId (not bare /documento)',
  );
  assert.ok(
    !/navigate\(\[\s*['"]\/documento['"]\s*,\s*id\s*\]\)/.test(lector),
    'lector must not hard-code navigate([/documento, id]) for all docs',
  );

  const backSvc = read('services/back.service.ts');
  assert.ok(
    /parentPathForAppUrl/.test(backSvc),
    'BackService.parentUrl delegates to parentPathForAppUrl',
  );

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

  console.log('ok santoral-ui-wiring');
  console.log(
    JSON.stringify({
      routes: ['/santoral', '/santoral/:id'],
      wbar: true,
      docRefs: true,
      saintDetailDocs: true,
      readingCta: true,
      narrator: true,
      temas: true,
      relacionados: true,
      santoralUnits: true,
      lectorBackToSantoral: true,
      calendarMode: true,
      calendarViews: ['anio', 'mes', 'dia'],
    }),
  );
}

main();
