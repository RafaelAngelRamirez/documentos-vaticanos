/**
 * Fixture test for scripts/corpus-sync-assets.sh.
 * Does not touch the real 1.3GB pack.
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'corpus-sync-assets.sh');

function writeFile(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

function runSync(src, dst, extraArgs = []) {
  const r = spawnSync('bash', [SCRIPT, ...extraArgs], {
    env: {
      ...process.env,
      CORPUS_CANONICAL: src,
      CORPUS_ASSETS: dst,
    },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(
      `sync failed (${r.status}): ${r.stderr || r.stdout || 'no output'}`,
    );
  }
  return r;
}

function main() {
  assert.ok(fs.existsSync(SCRIPT), `missing ${SCRIPT}`);
  const srcText = fs.readFileSync(SCRIPT, 'utf8');
  for (const needle of [
    'ocr-*-inventory.json',
    'revisions/',
    'pending-documents.json',
    'unlinked-refs-worksheet.json',
    'papacy',
    'santoral',
    'search',
    'context',
    'manifest.json',
    'documents',
  ]) {
    assert.ok(srcText.includes(needle), `script must mention ${needle}`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-sync-'));
  const src = path.join(tmp, 'canonical');
  const dst = path.join(tmp, 'assets');
  try {
    writeFile(path.join(src, 'documents', 'lg-es', 'content.json'), '{"id":"lg"}');
    writeFile(path.join(src, 'documents', 'lg-es', 'index.json'), '{"indice":{}}');
    writeFile(path.join(src, 'manifest.json'), '{"documents":[{"id":"lg-es"}]}');
    writeFile(path.join(src, 'papacy', 'manifest.json'), '{"popes":[]}');
    writeFile(path.join(src, 'santoral', 'manifest.json'), '{"saints":[]}');
    writeFile(path.join(src, 'search', 'es', 'doc-graph.json'), '{"nodes":[]}');
    writeFile(path.join(src, 'context', 'manifest.json'), '{"authors":[]}');
    writeFile(path.join(src, 'ocr-abc-inventory.json'), '{"skip":true}');
    writeFile(path.join(src, 'pending-documents.json'), '{"skip":true}');
    writeFile(path.join(src, 'unlinked-refs-worksheet.json'), '{"skip":true}');
    writeFile(path.join(src, 'revisions', 'ocr-abc', 'lg-es.json'), '{"skip":true}');

    runSync(src, dst);

    assert.strictEqual(
      fs.readFileSync(path.join(dst, 'documents', 'lg-es', 'content.json'), 'utf8'),
      '{"id":"lg"}',
    );
    assert.ok(fs.existsSync(path.join(dst, 'manifest.json')));
    assert.ok(fs.existsSync(path.join(dst, 'papacy', 'manifest.json')));
    assert.ok(fs.existsSync(path.join(dst, 'santoral', 'manifest.json')));
    assert.ok(fs.existsSync(path.join(dst, 'search', 'es', 'doc-graph.json')));
    assert.ok(fs.existsSync(path.join(dst, 'context', 'manifest.json')));
    assert.ok(
      !fs.existsSync(path.join(dst, 'ocr-abc-inventory.json')),
      'must not copy OCR inventory',
    );
    assert.ok(
      !fs.existsSync(path.join(dst, 'pending-documents.json')),
      'must not copy pending-documents.json',
    );
    assert.ok(
      !fs.existsSync(path.join(dst, 'unlinked-refs-worksheet.json')),
      'must not copy unlinked-refs-worksheet.json',
    );
    assert.ok(
      !fs.existsSync(path.join(dst, 'revisions')),
      'must not copy revisions/',
    );

    writeFile(path.join(src, 'documents', 'cic-es', 'content.json'), '{"id":"cic"}');
    runSync(src, dst, ['cic-es']);
    assert.strictEqual(
      fs.readFileSync(path.join(dst, 'documents', 'cic-es', 'content.json'), 'utf8'),
      '{"id":"cic"}',
    );
    console.log('OK corpus-sync-assets.test.js');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
