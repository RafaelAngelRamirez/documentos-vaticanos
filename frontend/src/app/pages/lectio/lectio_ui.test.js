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
  assert.ok(/app-pasaje/.test(html), 'passage reader on lectio');
  assert.ok(/data-testid=["']lectio-more["']/.test(html), 'optional day detail');
  const readAt = html.indexOf('data-testid="lectio-gospel-read"');
  const pasajeAt = html.indexOf('<app-pasaje');
  const moreAt = html.indexOf('data-testid="lectio-more"');
  const stepsAt = html.indexOf('lectio-steps');
  const litAt = html.indexOf('data-testid="lectio-lit"');
  assert.ok(readAt > 0 && readAt < pasajeAt, 'Leer sits above the passage');
  assert.ok(pasajeAt < moreAt, 'passage is outside the optional section');
  assert.ok(moreAt < litAt && moreAt < stepsAt, 'liturgy and steps are optional');
  assert.ok(/resolveCitedPassageFromCite/.test(ts), 'shared cited-passage resolver');
  const gospelFn = ts.slice(ts.indexOf('openGospel'), ts.indexOf('listenPassage'));
  assert.ok(/showPassage/.test(gospelFn), 'Leer shows the cited passage');
  assert.ok(!/openReading|navigate\(/.test(gospelFn), 'Leer stays on /lectio');
  assert.ok(/resolveCitedPassageFromCite/.test(inicioTs), 'inicio uses shared resolver');
  assert.ok(/listenPassage/.test(ts + html), 'listen speaks the passage on screen');
  assert.ok(/data-testid=["']lectio-gospel-read["']/.test(html));
  assert.ok(/data-testid=["']lectio-gospel-listen["']/.test(html));
  assert.ok(/data-testid=["']lectio-reflection-listen["']/.test(html));
  assert.ok(/listenReflection/.test(ts));
  assert.ok(/lectio\.listen_reflection/.test(html));
  assert.ok(/NarratorService/.test(ts));
  assert.ok(/speechLangForDocumentLocale/.test(ts));
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
