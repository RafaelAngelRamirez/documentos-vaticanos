/**
 * Corpus structure contract — drives SHIPPED load constants + dual-write roots
 * and asserts the real offline pack layout on disk (no re-implementation).
 *
 * Proves analysis claims in docs/CORPUS-STRUCTURE-ANALYSIS.md stay true:
 * - CORPUS_ROOT / MANIFEST_URL offline contract
 * - dual CORPUS_ROOTS still live
 * - per-doc content.json + index.json exist for every manifest entry
 * - dual roots byte-identical for sample docs
 *
 * Run from repo root:
 *   node scripts-descarga/corpus_structure_contract.test.js
 * Or from scripts-descarga:
 *   node corpus_structure_contract.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..');
const LOGIC_TS = path.join(
  REPO,
  'frontend/src/app/core/corpus/corpus-load.logic.ts',
);
const WRITE_CORPUS_TS = path.join(HERE, 'src/pipeline/write_corpus.ts');
const CANONICAL = path.join(REPO, 'documentos/corpus');
const ASSETS = path.join(REPO, 'frontend/src/assets/corpus');

const SAMPLE_IDS = [
  'aa-es',
  'cic-es',
  'lg-es',
  'bible-pueblo-de-dios-es',
  'lateran-i-la',
];

function md5File(filePath) {
  const h = crypto.createHash('md5');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex');
}

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function loadLogic() {
  assert.ok(fs.existsSync(LOGIC_TS), `missing ${LOGIC_TS}`);
  return import(pathToFileURL(LOGIC_TS).href + `?t=${Date.now()}`);
}

async function main() {
  section('shipped load contract constants');
  const logic = await loadLogic();
  assert.strictEqual(
    logic.CORPUS_ROOT,
    'assets/corpus',
    'CORPUS_ROOT must stay assets/corpus for offline ship path',
  );
  assert.strictEqual(
    logic.MANIFEST_URL,
    'assets/corpus/manifest.json',
    'MANIFEST_URL must point at ship manifest',
  );
  const engine = new logic.CorpusLoadEngine({
    httpGet: async () => {
      throw new Error('no http in structure test');
    },
    store: new logic.MemoryCorpusStore(),
  });
  assert.strictEqual(
    engine.resolveAssetPath('documents/lg-es/content.json'),
    'assets/corpus/documents/lg-es/content.json',
  );
  assert.strictEqual(
    engine.resolveAssetPath('/documents/lg-es/index.json'),
    'assets/corpus/documents/lg-es/index.json',
  );
  assert.strictEqual(
    engine.resolveAssetPath('assets/corpus/documents/x/content.json'),
    'assets/corpus/documents/x/content.json',
  );
  console.log('  CORPUS_ROOT, MANIFEST_URL, resolveAssetPath OK');

  section('dual-write CORPUS_ROOTS (shipped writer)');
  assert.ok(fs.existsSync(WRITE_CORPUS_TS), `missing ${WRITE_CORPUS_TS}`);
  const writeSrc = fs.readFileSync(WRITE_CORPUS_TS, 'utf8');
  assert.ok(
    writeSrc.includes('CORPUS_ROOTS'),
    'write_corpus must export CORPUS_ROOTS',
  );
  assert.ok(
    writeSrc.includes('documentos') && writeSrc.includes('corpus'),
    'CORPUS_ROOTS must include documentos/corpus',
  );
  assert.ok(
    writeSrc.includes('assets') && writeSrc.includes('corpus'),
    'CORPUS_ROOTS must include frontend/src/assets/corpus',
  );
  // Parse the two roots the same way the module defines them (no strip-types
  // dependency on write_corpus ts path resolution from node).
  const expectedRoots = [
    path.join(REPO, 'documentos', 'corpus'),
    path.join(REPO, 'frontend', 'src', 'assets', 'corpus'),
  ];
  for (const root of expectedRoots) {
    assert.ok(fs.existsSync(root), `corpus root missing: ${root}`);
    assert.ok(
      fs.existsSync(path.join(root, 'manifest.json')),
      `manifest missing under ${root}`,
    );
  }
  console.log('  dual roots present on disk:', expectedRoots.join(' | '));

  section('manifest + per-doc pack layout');
  const manCanon = JSON.parse(
    fs.readFileSync(path.join(CANONICAL, 'manifest.json'), 'utf8'),
  );
  const manAssets = JSON.parse(
    fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'),
  );
  assert.ok(Array.isArray(manCanon.documents), 'canonical manifest.documents');
  assert.ok(Array.isArray(manAssets.documents), 'assets manifest.documents');
  assert.strictEqual(
    manCanon.documents.length,
    manAssets.documents.length,
    'both manifests must list the same document count',
  );
  assert.ok(
    manCanon.documents.length >= 100,
    `expected ~125 docs, got ${manCanon.documents.length}`,
  );

  let missingBody = 0;
  let missingIndex = 0;
  for (const doc of manCanon.documents) {
    assert.ok(doc.id, 'document id required');
    assert.ok(doc.bodyPath, `${doc.id} bodyPath`);
    assert.ok(doc.indexPath, `${doc.id} indexPath`);
    const bodyA = path.join(CANONICAL, doc.bodyPath);
    const indexA = path.join(CANONICAL, doc.indexPath);
    const bodyB = path.join(ASSETS, doc.bodyPath);
    const indexB = path.join(ASSETS, doc.indexPath);
    if (!fs.existsSync(bodyA) || !fs.existsSync(bodyB)) missingBody++;
    if (!fs.existsSync(indexA) || !fs.existsSync(indexB)) missingIndex++;
  }
  assert.strictEqual(missingBody, 0, 'every bodyPath must exist on both roots');
  assert.strictEqual(missingIndex, 0, 'every indexPath must exist on both roots');
  console.log(
    `  ${manCanon.documents.length} docs; all bodyPath/indexPath present on both roots`,
  );

  section('dual-root sample byte identity');
  for (const id of SAMPLE_IDS) {
    const meta = manCanon.documents.find((d) => d.id === id);
    assert.ok(meta, `sample doc ${id} in manifest`);
    for (const rel of [meta.bodyPath, meta.indexPath, `documents/${id}/meta.json`]) {
      const a = path.join(CANONICAL, rel);
      const b = path.join(ASSETS, rel);
      assert.ok(fs.existsSync(a), `missing ${a}`);
      assert.ok(fs.existsSync(b), `missing ${b}`);
      assert.strictEqual(
        md5File(a),
        md5File(b),
        `dual-root mismatch ${rel}`,
      );
    }
    console.log(`  ${id}: content/index/meta MD5 equal`);
  }

  section('index/content size ratio sanity (analysis bound)');
  let contentBytes = 0;
  let indexBytes = 0;
  for (const doc of manCanon.documents) {
    contentBytes += fs.statSync(path.join(CANONICAL, doc.bodyPath)).size;
    indexBytes += fs.statSync(path.join(CANONICAL, doc.indexPath)).size;
  }
  const ratio = indexBytes / contentBytes;
  assert.ok(
    ratio > 0.4 && ratio < 0.9,
    `index/content ratio out of expected band: ${ratio}`,
  );
  console.log(
    `  content=${(contentBytes / 1024 / 1024).toFixed(1)}MiB` +
      ` index=${(indexBytes / 1024 / 1024).toFixed(1)}MiB` +
      ` ratio=${ratio.toFixed(3)}`,
  );

  section('gitignore excludes heavy intermediates');
  const gitignore = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
  for (const line of [
    'scripts-descarga/documentos/',
    'documentos/crawl/**/cache/',
    'documentos/padres-source/pdf/',
    'documentos/padres-source/raw/',
    'documentos/concilios-source/pdf/',
    'documentos/concilios-source/raw/',
  ]) {
    assert.ok(
      gitignore.includes(line),
      `.gitignore must exclude ${line}`,
    );
  }
  console.log('  heavy intermediate exclusions present');

  console.log('\nOK corpus_structure_contract');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
