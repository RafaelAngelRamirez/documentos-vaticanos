/**
 * Structural tests for Electron path resolution against the real production tree.
 * Run: node electron/paths.test.js  (from frontend/)
 * Or:  npm run test:electron-paths
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  getFrontendRoot,
  resolveWebDist,
  resolveIndexHtml,
  resolveCorpusManifest,
  assertWebDistReady,
  resolveStaticFile,
  mimeFor,
} = require('./paths');
const { startStaticServer } = require('./static-server');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('resolve paths');
  const root = getFrontendRoot();
  assert.strictEqual(
    path.basename(root),
    'frontend',
    'frontend root basename'
  );

  const webDist = resolveWebDist(root);
  const indexHtml = resolveIndexHtml(root);
  const corpus = resolveCorpusManifest(root);

  assert.ok(webDist.endsWith(path.join('dist', 'documentos-vaticanos')));
  assert.ok(indexHtml.endsWith('index.html'));
  assert.ok(corpus.includes(path.join('assets', 'corpus', 'manifest.json')));

  section('assertWebDistReady (real production tree)');
  const ready = assertWebDistReady(root);
  assert.ok(fs.existsSync(ready.indexHtml), 'index.html on disk');
  assert.ok(fs.existsSync(ready.corpusManifest), 'corpus manifest on disk');

  const indexBody = fs.readFileSync(ready.indexHtml, 'utf8');
  assert.ok(
    /main\.[a-f0-9]+\.js/.test(indexBody) || /src="[^"]+\.js"/.test(indexBody),
    'index.html references hashed or js bundles'
  );
  // Bundles referenced must exist
  const scriptRefs = [...indexBody.matchAll(/src="([^"]+\.js)"/g)].map(
    (m) => m[1]
  );
  assert.ok(scriptRefs.length > 0, 'at least one script in index.html');
  for (const rel of scriptRefs) {
    const abs = path.join(ready.webDist, rel.replace(/^\//, ''));
    assert.ok(fs.existsSync(abs), `bundle exists: ${rel}`);
  }

  const manifest = JSON.parse(fs.readFileSync(ready.corpusManifest, 'utf8'));
  assert.ok(
    Array.isArray(manifest.documents) ||
      Array.isArray(manifest) ||
      typeof manifest === 'object',
    'corpus manifest is JSON object/array'
  );

  section('resolveStaticFile SPA fallback');
  assert.strictEqual(
    resolveStaticFile(ready.webDist, '/'),
    path.join(ready.webDist, 'index.html')
  );
  assert.strictEqual(
    resolveStaticFile(ready.webDist, '/inicio'),
    path.join(ready.webDist, 'index.html')
  );
  const mainJsRel = scriptRefs[0].replace(/^\//, '');
  assert.strictEqual(
    resolveStaticFile(ready.webDist, '/' + mainJsRel),
    path.join(ready.webDist, mainJsRel)
  );

  section('mimeFor');
  assert.ok(mimeFor('x.html').includes('text/html'));
  assert.ok(mimeFor('x.js').includes('javascript'));
  assert.ok(mimeFor('x.json').includes('json'));

  section('static server serves index + corpus');
  const srv = await startStaticServer(ready.webDist);
  try {
    const resIndex = await fetch(srv.url);
    assert.strictEqual(resIndex.status, 200, 'GET / → 200');
    const html = await resIndex.text();
    assert.ok(html.includes('<html'), 'HTML body');
    assert.ok(html.length > 100, 'non-empty index');

    const resCorpus = await fetch(srv.url + 'assets/corpus/manifest.json');
    assert.strictEqual(resCorpus.status, 200, 'GET corpus manifest → 200');
    const corpusJson = await resCorpus.json();
    assert.ok(corpusJson && typeof corpusJson === 'object');

    const resSpa = await fetch(srv.url + 'biblioteca');
    assert.strictEqual(resSpa.status, 200, 'SPA path → 200');
    const spaHtml = await resSpa.text();
    assert.ok(spaHtml.includes('<html'), 'SPA fallback returns index');
  } finally {
    await srv.close();
  }

  console.log('\nAll electron path/static-server tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
