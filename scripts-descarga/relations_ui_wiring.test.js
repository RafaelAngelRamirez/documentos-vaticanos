/**
 * Structural checks for Explorar Relaciones + citegraph + reader ref chips.
 * Run: node scripts-descarga/relations_ui_wiring.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FE = path.join(ROOT, 'frontend', 'src', 'app');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

const routing = read(path.join(FE, 'pages/pages-routing.module.ts'));
assert.ok(
  routing.includes("path: 'explorar/relaciones'"),
  'route explorar/relaciones before explorar',
);
const explIdx = routing.indexOf("path: 'explorar'");
const relIdx = routing.indexOf("path: 'explorar/relaciones'");
assert.ok(relIdx >= 0 && relIdx < explIdx, 'specific route first');

const explHtml = read(path.join(FE, 'pages/explorar/explorar.component.html'));
assert.ok(explHtml.includes('Relaciones'), 'tab label');
assert.ok(explHtml.includes('app-citegraph'), 'svg component');
assert.ok(explHtml.includes('Citas cruzadas'), 'section copy');

const explTs = read(path.join(FE, 'pages/explorar/explorar.component.ts'));
assert.ok(!/\bensureAllLoaded\b/.test(explTs), 'no ensureAllLoaded');
assert.ok(explTs.includes('TopicIndexService'), 'pack loader');
assert.ok(explTs.includes('openReading'), 'CTA lectura from samples');

const puntoHtml = read(
  path.join(FE, 'components/punto/punto/punto.component.html'),
);
assert.ok(puntoHtml.includes('punto-local-refs'), 'reader local ref chips');
assert.ok(puntoHtml.includes('openLocalRef'), 'chip click');

const cover = read(
  path.join(FE, 'pages/documento-detalle/documento-detalle.component.html'),
);
assert.ok(cover.includes('Citas cruzadas'), '2A neighbors');
assert.ok(cover.includes('explorar/relaciones'), 'map deep link');

const styles = read(path.join(ROOT, 'frontend/src/styles.css'));
assert.ok(styles.includes('.citegraph'), 'system class');
assert.ok(!/#[0-9a-fA-F]{3,8}/.test(styles.match(/\.citegraph[\s\S]{0,400}/)[0] || ''), 'no hex in citegraph block');

console.log('relations_ui_wiring.test.js: ok');
