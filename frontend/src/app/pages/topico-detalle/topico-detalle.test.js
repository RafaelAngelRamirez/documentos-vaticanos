/**
 * Structural + pure-helper checks for topic detail snippet hydrate (PR6 polish).
 * Run: node frontend/src/app/pages/topico-detalle/topico-detalle.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const TS = path.join(DIR, 'topico-detalle.component.ts');
const HTML = path.join(DIR, 'topico-detalle.component.html');
const CSS = path.join(DIR, 'topico-detalle.component.css');

function section(title) {
  console.log(`\n== ${title}`);
}

/** Minimal extract of exported plainSnippet from the component source (strip types). */
function loadPlainSnippet() {
  const src = fs.readFileSync(TS, 'utf8');
  const m = src.match(/export function plainSnippet\([\s\S]*?\n\}/);
  assert.ok(m, 'plainSnippet export found in component');
  const sandbox = { module: { exports: {} } };
  // Drop TS annotations + resolve SNIPPET_MAX default for plain node eval.
  const stripped = m[0]
    .replace('export function', 'function')
    .replace(/:\s*string\s*\|\s*undefined/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*number/g, '')
    .replace(/=\s*SNIPPET_MAX/g, '= 160');
  const code = `${stripped}\nmodule.exports = { plainSnippet };`;
  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports.plainSnippet;
}

function main() {
  section('files exist');
  assert.ok(fs.existsSync(TS), 'topico-detalle.component.ts');
  assert.ok(fs.existsSync(HTML), 'topico-detalle.component.html');
  assert.ok(fs.existsSync(CSS), 'topico-detalle.component.css');
  console.log('  ok');

  const src = fs.readFileSync(TS, 'utf8');
  const html = fs.readFileSync(HTML, 'utf8');

  section('snippet hydrate uses ensureLoadedMany (not full corpus)');
  assert.ok(
    src.includes('CargarDocumentosJsonService'),
    'injects CargarDocumentosJsonService',
  );
  assert.ok(
    /\bensureLoadedMany\b/.test(src),
    'calls ensureLoadedMany for body hydrate',
  );
  assert.ok(
    !/\.ensureAllLoaded\s*\(/.test(src) && !/\bensureAllLoaded\s*\(/.test(src),
    'must not call ensureAllLoaded',
  );
  assert.ok(
    !/\bensureLoadedForLocale\s*\(/.test(src),
    'must not call ensureLoadedForLocale of whole locale',
  );
  assert.ok(
    /DEFAULT_BODY_LOAD_CONCURRENCY/.test(src),
    'uses DEFAULT_BODY_LOAD_CONCURRENCY pool',
  );
  assert.ok(
    /SNIPPET_DOC_CAP\s*=\s*24/.test(src) || /SNIPPET_DOC_CAP/.test(src),
    'caps unique docs (SNIPPET_DOC_CAP)',
  );
  console.log('  ok');

  section('snippet field + plainSnippet helper');
  assert.ok(
    /snippet\s*:/.test(src) || /snippet\?:/.test(src) || /snippet: string/.test(src),
    'TopicCitationRow has snippet field',
  );
  assert.ok(
    /export function plainSnippet/.test(src),
    'exports plainSnippet pure helper',
  );
  assert.ok(
    /\[\+\\\[\\d\+\\\]\+\]/.test(src) ||
      /replace\(\s*\/\\\[\\\+\\\[\\d\+\\\]\\\+\\\]/.test(src) ||
      src.includes('[+[') ||
      src.includes('\\[\\+\\['),
    'plainSnippet strips [+[digits]+] markers',
  );
  console.log('  ok');

  section('gen cancel + expand re-hydrate');
  assert.ok(
    /snippetGen|hydrateGen|myGen/.test(src),
    'gen counter for cancel stale loads',
  );
  assert.ok(
    /expandList/.test(src) &&
      (src.includes('hydrateSnippets') || src.includes('ensureLoadedMany')),
    'expandList triggers further hydrate',
  );
  console.log('  ok');

  section('HTML: snippet under title + loading flag');
  assert.ok(
    html.includes('row.snippet') || html.includes('topico-snippet'),
    'template shows snippet text',
  );
  assert.ok(
    html.includes('class="sx') || html.includes('topico-snippet'),
    'uses .sx or .topico-snippet',
  );
  assert.ok(
    html.includes('snippetsLoading') || html.includes('Cargando extractos'),
    'optional snippetsLoading muted status',
  );
  console.log('  ok');

  section('openCitation still navigateToUnit');
  assert.ok(
    /navigateToUnit/.test(src),
    'openCitation uses navigateToUnit',
  );
  assert.ok(
    /consecutivo/.test(src),
    'passes consecutivo',
  );
  console.log('  ok');

  section('plainSnippet pure behavior');
  const plainSnippet = loadPlainSnippet();
  assert.strictEqual(plainSnippet(''), '');
  assert.strictEqual(plainSnippet(undefined), '');
  assert.strictEqual(
    plainSnippet('  Hola   mundo  '),
    'Hola mundo',
  );
  assert.strictEqual(
    plainSnippet('Texto [+[12]+] con marca'),
    'Texto con marca',
  );
  const long = 'a'.repeat(200);
  const sn = plainSnippet(long, 160);
  assert.ok(sn.length <= 160, 'truncatedates to max');
  assert.ok(sn.endsWith('…'), 'ellipsis on truncate');
  assert.ok(!sn.includes('[+['), 'no markers left');
  console.log('  ok');

  console.log('\nAll topico-detalle tests passed.');
}

main();
