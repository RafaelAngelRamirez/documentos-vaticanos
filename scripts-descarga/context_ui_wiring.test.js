/**
 * Static + structural checks for historical context UI wiring.
 *
 * Run: node scripts-descarga/context_ui_wiring.test.js
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
  const service = read('core/context/historical-context.service.ts');
  assert.ok(/HISTORICAL_CONTEXT_MANIFEST_URL|assets\/corpus\/context/.test(service));
  assert.ok(/contextForDocument/.test(service));
  assert.ok(/contextForSaint/.test(service));

  const logic = read('core/context/historical-context-resolve.logic.ts');
  assert.ok(/resolveHistoricalContext/.test(logic));
  assert.ok(/isCoverageComplete/.test(logic));

  const block = read(
    'components/historical-context-block/historical-context-block.component.ts',
  );
  assert.ok(/selector:\s*['"]app-historical-context-block['"]/.test(block));

  const blockHtml = read(
    'components/historical-context-block/historical-context-block.component.html',
  );
  assert.ok(/Referencias|references/.test(blockHtml));
  assert.ok(/axisRows|hist-ctx-axis/.test(blockHtml));

  const docHtml = read('pages/documento-detalle/documento-detalle.component.html');
  assert.ok(
    /app-historical-context-block/.test(docHtml),
    'doc cover must host historical-context-block',
  );
  assert.ok(/historicalContext/.test(docHtml));

  const docTs = read('pages/documento-detalle/documento-detalle.component.ts');
  assert.ok(/HistoricalContextService/.test(docTs));
  assert.ok(/historicalContext/.test(docTs));
  assert.ok(/contextForDocument/.test(docTs));

  const santoHtml = read('pages/santo-detalle/santo-detalle.component.html');
  assert.ok(
    /app-historical-context-block/.test(santoHtml),
    'saint detail must host historical-context-block',
  );

  const santoTs = read('pages/santo-detalle/santo-detalle.component.ts');
  assert.ok(/HistoricalContextService/.test(santoTs));
  assert.ok(/contextForSaint/.test(santoTs));

  const padreHtml = read('pages/padre-detalle/padre-detalle.component.html');
  assert.ok(
    /app-historical-context-block/.test(padreHtml),
    'padre detail hosts context when author profile exists',
  );
  const padreTs = read('pages/padre-detalle/padre-detalle.component.ts');
  assert.ok(/HistoricalContextService/.test(padreTs));

  // Offline pack present (no network)
  const pack = path.join(
    REPO,
    'frontend/src/assets/corpus/context/manifest.json',
  );
  assert.ok(fs.existsSync(pack), 'offline context pack must exist in assets');

  console.log('ok context-ui-wiring');
  console.log(
    JSON.stringify({
      docDetail: true,
      santoDetail: true,
      block: 'app-historical-context-block',
      offlinePack: true,
      service: 'HistoricalContextService',
    }),
  );
}

main();
