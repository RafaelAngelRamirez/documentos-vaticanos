/**
 * Structural wiring: inicio shows santos del día + detail access.
 * Run: node scripts-descarga/inicio_saints_day_ui.test.js
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
  const cal = read('core/santoral/santoral-calendar.logic.ts');

  assert.ok(
    /Santos del día|santos del día|inicio-saints-day/.test(html),
    'inicio template marks saints-of-day block',
  );
  assert.ok(
    /data-testid=["']inicio-saints-day["']/.test(html),
    'data-testid inicio-saints-day',
  );
  assert.ok(
    /saintsToday|santosToday|saintsOfDay/.test(ts + html),
    'binds saints of day from pack logic',
  );
  assert.ok(
    /routerLink.*santoral|navigate\(\[\s*['"]\/santoral['"]/.test(html + ts),
    'navigates or links to /santoral/:id',
  );
  assert.ok(
    /inicio-saints-empty|No hay fiestas|pack offline/.test(html),
    'empty state present',
  );
  assert.ok(
    /briefSaintIntro|saintIntro/.test(ts + html),
    'brief intro from pack fields',
  );
  assert.ok(/SantoralService|loadManifest/.test(ts), 'loads offline pack');
  assert.ok(/saintsOfDay|localFeastKey|briefSaintIntro/.test(cal));
  assert.ok(/saintsOfDay/.test(cal) && /briefSaintIntro/.test(cal));

  // One-tap listen → lector + auto-narrator (same as ficha)
  assert.ok(
    /Escuchar|listenSaint|inicio-saint-listen/.test(html + ts),
    'listen shortcut on home saints block',
  );
  assert.ok(
    /dv\.autoNarr|autoNarr/.test(ts),
    'sets auto-narrator flag like saint cover',
  );
  assert.ok(
    /loadReadingDocumentForSaint|ROUTE\.leyendo|leyendo/.test(ts),
    'listen opens real lector path for santoral doc',
  );

  console.log('ok inicio-saints-day-ui');
  console.log(
    JSON.stringify({
      block: 'inicio-saints-day',
      empty: true,
      detailLink: true,
      listenShortcut: true,
      pureHelpers: ['localFeastKey', 'saintsOfDay', 'briefSaintIntro'],
    }),
  );
}

main();
