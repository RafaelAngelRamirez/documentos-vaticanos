/**
 * Structural wiring: Inicio Misal block + santoral calendar Misal entry.
 * Mirrors inicio_saints_day_ui / santoral_ui_wiring style.
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
  // —— Pure logic module ——
  const logicPath = path.join(FE, 'core/misal/misal-liturgia.logic.ts');
  assert.ok(fs.existsSync(logicPath), 'misal-liturgia.logic.ts');
  const logic = fs.readFileSync(logicPath, 'utf8');
  assert.ok(/pickPrimaryMisalEntry/.test(logic));
  assert.ok(/listMisalLiturgiaDocuments/.test(logic));
  assert.ok(/igmr-/.test(logic));
  assert.ok(/missale-romanum-apc-/.test(logic));
  assert.ok(/rm-es|Redemptoris/.test(logic), 'documents collision note with rm-es');

  // —— Inicio ——
  const html = read('pages/inicio/inicio.component.html');
  const ts = read('pages/inicio/inicio.component.ts');
  assert.ok(
    /data-testid=["']inicio-misal["']/.test(html),
    'inicio-misal testid',
  );
  assert.ok(
    /Misal y liturgia|misalTitle|inicio-misal-heading/.test(html + ts),
    'Misal block title',
  );
  assert.ok(
    /inicio-saints-day/.test(html),
    'saints block still present beside misal',
  );
  assert.ok(
    /inicio-misal-read|openMisalDoc|misalPrimary/.test(html + ts),
    'read CTA for misal',
  );
  assert.ok(
    /inicio-misal-listen|listenMisal|dv\.autoNarr/.test(html + ts),
    'listen CTA with autoNarr',
  );
  assert.ok(
    /pickPrimaryMisalEntry|CorpusService/.test(ts),
    'loads corpus for misal packs',
  );
  assert.ok(
    /openReading|ROUTE\.leyendo|leyendo/.test(ts),
    'listen opens immersive lector',
  );
  assert.ok(
    /documento/.test(html + ts),
    'document cover path available',
  );
  assert.ok(
    /inicio-misal-calendar|vista.*calendario/.test(html),
    'link toward calendar',
  );

  // —— Santoral calendar ——
  const calHtml = read('pages/santoral/santoral.component.html');
  const calTs = read('pages/santoral/santoral.component.ts');
  assert.ok(
    /data-testid=["']santoral-cal-misal["']/.test(calHtml),
    'calendar misal block',
  );
  assert.ok(
    /openMisal|misalPrimary|pickPrimaryMisalEntry/.test(calTs),
    'calendar wires misal pick',
  );
  assert.ok(
    /santoral-cal-misal-read|\/documento/.test(calHtml + calTs),
    'calendar CTA to document/read',
  );
  assert.ok(
    /mode === ['"]calendario['"]|calLevel/.test(calHtml),
    'misal sits in calendar mode surface',
  );

  // —— Ordinary document path (notes/progress) ——
  // Packs are normal DocumentMeta; AnotacionesService keys by documentId+unitIndex
  const anot = read('services/anotaciones.service.ts');
  assert.ok(
    /documentId|unitIndex|dv_anotaciones/.test(anot),
    'annotations use standard documentId+unitIndex store',
  );
  assert.ok(
    !/igmr|missale-romanum-apc|misal.*storage/i.test(anot),
    'no special-case misal storage keys in AnotacionesService',
  );

  console.log('ok misal-ui-wiring');
  console.log(
    JSON.stringify({
      inicio: 'inicio-misal',
      calendar: 'santoral-cal-misal',
      logic: 'misal-liturgia.logic',
      annotations: 'ordinary documentId+unitIndex',
    }),
  );
}

main();
