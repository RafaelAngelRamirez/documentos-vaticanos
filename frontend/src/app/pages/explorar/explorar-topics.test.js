/**
 * Structural checks for Explorar "Temas" tab → offline topic pack (PR6).
 * Run: node frontend/src/app/pages/explorar/explorar-topics.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TS = path.join(DIR, 'explorar.component.ts');
const HTML = path.join(DIR, 'explorar.component.html');

function section(title) {
  console.log(`\n== ${title}`);
}

function main() {
  section('files exist');
  assert.ok(fs.existsSync(TS), 'explorar.component.ts');
  assert.ok(fs.existsSync(HTML), 'explorar.component.html');
  console.log('  ok');

  const src = fs.readFileSync(TS, 'utf8');
  const html = fs.readFileSync(HTML, 'utf8');

  section('TopicIndexService + loadPack');
  assert.ok(
    src.includes('TopicIndexService'),
    'explorar.component.ts imports TopicIndexService',
  );
  assert.ok(
    src.includes('ReaderPreferencesService'),
    'injects ReaderPreferencesService for contentLocale',
  );
  assert.ok(
    /\.loadPack\s*\(/.test(src) || src.includes('loadPack'),
    'calls loadPack for topic pack',
  );
  assert.ok(
    !/\bensureAllLoaded\b/.test(src),
    'no ensureAllLoaded (corpus-wide preload forbidden here)',
  );
  console.log('  ok');

  section('navigate to explorar/topicos');
  assert.ok(
    src.includes("/explorar/topicos") ||
      src.includes("'/explorar/topicos'") ||
      src.includes('"/explorar/topicos"') ||
      /explorar\/topicos/.test(src),
    'navigates to /explorar/topicos/:slug',
  );
  assert.ok(
    src.includes('openTopic') || /navigate\(\s*\[\s*['"]\/explorar\/topicos/.test(src),
    'openTopic or navigate to topicos',
  );
  console.log('  ok');

  section('chips from pack, not only hardcoded Fe y razón');
  assert.ok(
    src.includes('loadPack') || src.includes('TopicRecord'),
    'topic chips source includes pack (loadPack / TopicRecord)',
  );
  // Hardcoded "Fe y razón" may remain as fallback, but must not be sole chip source.
  const hasPackSource =
    src.includes('loadPack') &&
    (src.includes('featuredTopics') ||
      src.includes('TopicRecord') ||
      src.includes('topics =') ||
      src.includes('this.topics'));
  assert.ok(
    hasPackSource,
    'hardcoded Fe y razón alone is NOT the only chip source',
  );
  console.log('  ok');

  section('relaciones tab + route');
  assert.ok(html.includes('Relaciones'), 'Relaciones tab in template');
  assert.ok(
    /relaciones/.test(src),
    'tab relaciones in component',
  );
  assert.ok(
    src.includes('CitegraphComponent') || src.includes('app-citegraph'),
    'citegraph wired',
  );
  assert.ok(!/\bensureAllLoaded\b/.test(src), 'no ensureAllLoaded on relations');
  console.log('  ok');

  section('UI copy + personal themes link');
  assert.ok(
    html.includes('Temas del corpus') || html.includes('índice offline'),
    'UI notes corpus offline index',
  );
  assert.ok(
    html.includes('/cuenta/temas') || html.includes('Mis temas personales'),
    'link to personal themes',
  );
  console.log('  ok');

  console.log('\nAll explorar-topics tests passed.');
}

main();
