/**
 * Listen / cover CTA handoff must go through NavigationService.openReading
 * (AUTO_NARR_KEY) — no cloned TTS player on fichas, no raw sessionStorage flag.
 *
 * Run from frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/services/open-reading.handoff.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP = path.resolve(__dirname, '..');

function read(rel) {
  const p = path.join(APP, rel);
  assert.ok(fs.existsSync(p), `missing ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

function walkTsHtml(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walkTsHtml(full, acc);
      continue;
    }
    if (/\.(ts|html)$/.test(name) && !/\.spec\.ts$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

async function main() {
  const logic = await import(
    pathToFileURL(path.join(__dirname, 'open-reading.logic.ts')).href
  );
  const { AUTO_NARR_KEY, applyAutoNarrFlag, resolveCoverReadingIndex } = logic;
  assert.strictEqual(AUTO_NARR_KEY, 'dv.autoNarr');

  const store = { setItem(k, v) { this.k = k; this.v = v; } };
  applyAutoNarrFlag(true, store);
  assert.strictEqual(store.k, AUTO_NARR_KEY);
  assert.strictEqual(store.v, '1');
  assert.strictEqual(resolveCoverReadingIndex(true, 7), 7);

  const rawFlag = /sessionStorage\.setItem\(\s*['"]dv\.autoNarr['"]/;
  const surfaces = [
    ['pages/inicio/inicio.component.ts', /openReading\(/],
    ['pages/documento-detalle/documento-detalle.component.ts', /openReading\(/],
    ['pages/santo-detalle/santo-detalle.component.ts', /openReading\(/],
    ['pages/topico-detalle/topico-detalle.component.ts', /navigateToUnit\(/],
    ['pages/estudios/estudios.component.ts', /openReading\(/],
    ['pages/padre-detalle/padre-detalle.component.ts', /openReading\(/],
    ['pages/doctor-detalle/doctor-detalle.component.ts', /openReading\(/],
  ];
  for (const [rel, handoff] of surfaces) {
    const src = read(rel);
    assert.ok(!rawFlag.test(src), `${rel} must not set dv.autoNarr directly`);
    assert.ok(handoff.test(src), `${rel} must use shared reader handoff`);
    assert.ok(
      /autoNarr/.test(src),
      `${rel} must pass autoNarr into the shared handoff`,
    );
  }

  const listenTemplates = [
    'pages/documento-detalle/documento-detalle.component.html',
    'pages/santo-detalle/santo-detalle.component.html',
    'pages/topico-detalle/topico-detalle.component.html',
    'pages/padre-detalle/padre-detalle.component.html',
    'pages/doctor-detalle/doctor-detalle.component.html',
    'pages/inicio/inicio.component.html',
  ];
  for (const rel of listenTemplates) {
    const html = read(rel);
    assert.ok(!/\bclass=["'][^"']*\bnarr\b/.test(html), `${rel} has no .narr player`);
    assert.ok(!/speechSynthesis/.test(html), `${rel} does not call speechSynthesis`);
  }

  const coverHtml = read('components/reading-cover/reading-cover.component.html');
  const mobileCtas = (coverHtml.match(/rc-ctas-mobile only-mobile/g) || []).length;
  const deskCtas = (coverHtml.match(/rc-ctas-desk only-desktop/g) || []).length;
  assert.strictEqual(mobileCtas, 1, 'one mobile CTA stack on document cover');
  assert.strictEqual(deskCtas, 1, 'one desktop CTA stack on document cover');
  assert.ok(
    /app-reading-ctas[\s\S]*only-mobile|only-mobile[\s\S]*app-reading-ctas/.test(
      coverHtml,
    ),
    'mobile CTA block is viewport-gated',
  );

  const fichaHtml = read('components/person-ficha/person-ficha.component.ts');
  assert.ok(/fbar hair only-mobile/.test(fichaHtml), 'ficha fbar is mobile-only');
  assert.ok(/ficha-desk-back only-desktop/.test(fichaHtml), 'ficha desktop back gated');

  const padreHtml = read('pages/padre-detalle/padre-detalle.component.html');
  const doctorHtml = read('pages/doctor-detalle/doctor-detalle.component.html');
  assert.ok(/app-reading-ctas/.test(padreHtml), 'padre ficha exposes reading CTAs');
  assert.ok(/app-reading-ctas/.test(doctorHtml), 'doctor ficha exposes reading CTAs');
  assert.ok(!/title="Favorito"/.test(padreHtml), 'padre has no dead fav');
  assert.ok(!/title="Favorito"/.test(doctorHtml), 'doctor has no dead fav');

  const pagesTs = read('pages/pages.component.ts');
  assert.ok(/isImmersivePath/.test(pagesTs), 'PagesComponent uses isImmersivePath');

  const speechFiles = walkTsHtml(APP).filter((f) => {
    const src = fs.readFileSync(f, 'utf8');
    return /speechSynthesis/.test(src);
  });
  const rels = speechFiles.map((f) => path.relative(APP, f));
  assert.ok(rels.length >= 1, 'NarratorService must use speechSynthesis');
  assert.ok(
    rels.every((r) => r.startsWith('services/narrator.service')),
    `speechSynthesis only in NarratorService, got ${rels.join(', ')}`,
  );

  const docTs = read('pages/documento-detalle/documento-detalle.component.ts');
  assert.ok(!/\bensureAllLoaded\b/.test(docTs), 'document cover loads one pack');
  assert.ok(/\bensureLoaded\b/.test(docTs), 'document cover uses ensureLoaded');
  assert.ok(
    /this\.fav[\s\S]*this\.loading = false[\s\S]*this\.corpus\.ensureLoaded/.test(
      docTs,
    ),
    'cover paints from manifest before ensureLoaded body',
  );

  console.log('open-reading.handoff.test.js: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
