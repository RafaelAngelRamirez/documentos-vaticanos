/**
 * Tests for ship corpus compression prescript.
 * Drives the shipped module scripts/corpus-compress.js (no reimplementation).
 *
 * Run from repo root:
 *   node scripts/corpus-compress.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const COMPRESS_JS = path.join(ROOT, 'scripts', 'corpus-compress.js');
const ASSETS = path.join(ROOT, 'frontend', 'src', 'assets', 'corpus');
const PACKAGE_WEB = path.join(ROOT, 'scripts', 'package-web.sh');
const PACKAGE_APK = path.join(ROOT, 'scripts', 'package-apk.sh');
const PACKAGE_ELECTRON = path.join(ROOT, 'scripts', 'package-electron.sh');
const PACKAGE_ALL = path.join(ROOT, 'scripts', 'package-all.sh');

const {
  compressUnit,
  compressJsonValue,
  compressJsonBuffer,
  compressCorpusTree,
  readingSnapshot,
} = require('./corpus-compress.js');

function section(name) {
  console.log(`\n== ${name} ==`);
}

function dirBytes(dir) {
  let total = 0;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.isFile()) total += fs.statSync(p).size;
    }
  };
  walk(dir);
  return total;
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function main() {
  section('module exports pure transform');
  assert.ok(typeof compressUnit === 'function');
  assert.ok(typeof compressJsonValue === 'function');
  assert.ok(typeof compressJsonBuffer === 'function');
  assert.ok(typeof compressCorpusTree === 'function');
  assert.ok(typeof readingSnapshot === 'function');
  console.log('  exports OK');

  section('compressUnit strips empty refs + index_array, keeps body');
  const unitIn = {
    consecutivo: 'CIC 27',
    contenido: 'El deseo de Dios',
    referencias: [],
    index_array: 3,
    biblia: undefined,
  };
  // explicit biblia omitted in object literal if undefined — set after
  unitIn.extra = 'keep';
  const unitOut = compressUnit(unitIn);
  assert.strictEqual(unitOut.consecutivo, 'CIC 27');
  assert.strictEqual(unitOut.contenido, 'El deseo de Dios');
  assert.ok(!Object.prototype.hasOwnProperty.call(unitOut, 'referencias'));
  assert.ok(!Object.prototype.hasOwnProperty.call(unitOut, 'index_array'));
  assert.strictEqual(unitOut.extra, 'keep');
  // non-empty refs preserved
  const withRefs = compressUnit({
    consecutivo: '1',
    contenido: 'x',
    referencias: [{ descripcion: 'cf. Mc 16,15' }],
    index_array: 0,
  });
  assert.deepStrictEqual(withRefs.referencias, [
    { descripcion: 'cf. Mc 16,15' },
  ]);
  assert.ok(!Object.prototype.hasOwnProperty.call(withRefs, 'index_array'));
  console.log('  unit transform OK');

  section('compressJsonBuffer size reduction on synthetic content');
  const synthetic = [];
  for (let i = 0; i < 200; i++) {
    synthetic.push({
      consecutivo: String(i + 1),
      contenido: `Unit body text number ${i} with enough bulk to stay stable.`,
      referencias: [],
      index_array: i,
    });
  }
  const raw = Buffer.from(JSON.stringify(synthetic, null, 2), 'utf8'); // pretty → bigger
  const { output, parsed } = compressJsonBuffer(raw, 'content.json');
  assert.ok(
    output.length < raw.length,
    `expected smaller output (${output.length} < ${raw.length})`,
  );
  assert.ok(Array.isArray(parsed));
  assert.strictEqual(parsed.length, 200);
  const snapIn = readingSnapshot(JSON.parse(raw.toString('utf8')));
  const snapOut = readingSnapshot(parsed);
  assert.strictEqual(snapOut.unitCount, snapIn.unitCount);
  for (let i = 0; i < snapIn.unitCount; i++) {
    assert.strictEqual(snapOut.units[i].consecutivo, snapIn.units[i].consecutivo);
    assert.strictEqual(snapOut.units[i].contenido, snapIn.units[i].contenido);
    assert.deepStrictEqual(
      snapOut.units[i].referencias,
      snapIn.units[i].referencias,
    );
  }
  console.log(
    `  synthetic: ${raw.length} → ${output.length} (−${raw.length - output.length} B)`,
  );

  section('real sample docs: size + reading parity (shipped transform)');
  const sampleIds = ['lg-es', 'aa-es', 'cic-es'].filter((id) =>
    fs.existsSync(path.join(ASSETS, 'documents', id, 'content.json')),
  );
  assert.ok(
    sampleIds.length >= 1,
    `need at least one sample under ${ASSETS}/documents`,
  );

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-compress-test-'));
  try {
    // Mini pack: manifest + sample docs only
    const man = JSON.parse(
      fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'),
    );
    const docs = man.documents.filter((d) => sampleIds.includes(d.id));
    assert.ok(docs.length >= 1, 'manifest must list sample ids');
    const mini = { version: man.version, generatedAt: man.generatedAt, documents: docs };
    fs.writeFileSync(
      path.join(tmpRoot, 'manifest.json'),
      JSON.stringify(mini, null, 2), // pretty so compact step has work
    );
    for (const id of sampleIds) {
      const src = path.join(ASSETS, 'documents', id);
      const dest = path.join(tmpRoot, 'documents', id);
      copyTree(src, dest);
    }

    const before = dirBytes(tmpRoot);
    const beforeSnaps = {};
    for (const id of sampleIds) {
      const body = JSON.parse(
        fs.readFileSync(
          path.join(tmpRoot, 'documents', id, 'content.json'),
          'utf8',
        ),
      );
      beforeSnaps[id] = readingSnapshot(body);
    }

    const stats = compressCorpusTree(tmpRoot, { keepMeta: false });
    const after = dirBytes(tmpRoot);

    assert.ok(
      after < before,
      `expected tree shrink: after=${after} before=${before}`,
    );
    assert.ok(stats.bytesAfter < stats.bytesBefore, 'stats must report shrink');
    assert.ok(
      fs.existsSync(path.join(tmpRoot, 'manifest.json')),
      'manifest must remain',
    );
    assert.ok(
      !fs.existsSync(path.join(tmpRoot, 'documents', sampleIds[0], 'meta.json')),
      'meta.json should be omitted from ship tree',
    );

    for (const id of sampleIds) {
      const bodyPath = path.join(tmpRoot, 'documents', id, 'content.json');
      const indexPath = path.join(tmpRoot, 'documents', id, 'index.json');
      assert.ok(fs.existsSync(bodyPath), `${id} content.json`);
      assert.ok(fs.existsSync(indexPath), `${id} index.json`);
      const body = JSON.parse(fs.readFileSync(bodyPath, 'utf8'));
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const snap = readingSnapshot(body);
      assert.strictEqual(snap.unitCount, beforeSnaps[id].unitCount, `${id} unitCount`);
      for (let i = 0; i < snap.unitCount; i++) {
        assert.strictEqual(
          snap.units[i].consecutivo,
          beforeSnaps[id].units[i].consecutivo,
          `${id}[${i}].consecutivo`,
        );
        assert.strictEqual(
          snap.units[i].contenido,
          beforeSnaps[id].units[i].contenido,
          `${id}[${i}].contenido`,
        );
        assert.deepStrictEqual(
          snap.units[i].referencias,
          beforeSnaps[id].units[i].referencias,
          `${id}[${i}].referencias`,
        );
      }
      // no persisted index_array after compress
      for (const u of body) {
        assert.ok(
          !Object.prototype.hasOwnProperty.call(u, 'index_array'),
          `${id} must not persist index_array`,
        );
      }
      assert.ok(index && typeof index === 'object', `${id} index object`);
      assert.ok(
        index.indice && typeof index.indice === 'object',
        `${id} index.indice`,
      );
    }

    // CLI entry on same tree (idempotent second pass should not grow)
    const after1 = dirBytes(tmpRoot);
    execFileSync(process.execPath, [COMPRESS_JS, '--root', tmpRoot], {
      encoding: 'utf8',
    });
    const after2 = dirBytes(tmpRoot);
    assert.ok(
      after2 <= after1,
      `idempotent pass must not grow: ${after2} vs ${after1}`,
    );

    console.log(
      `  samples ${sampleIds.join(',')}: ${before} → ${after} (−${before - after} B); stats.saved=${stats.bytesBefore - stats.bytesAfter}`,
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  section('search/ sibling pack is preserved (topic-search scaffold)');
  {
    const tmpSearch = fs.mkdtempSync(
      path.join(os.tmpdir(), 'corpus-compress-search-'),
    );
    try {
      fs.writeFileSync(
        path.join(tmpSearch, 'manifest.json'),
        JSON.stringify({ version: '1', documents: [] }),
      );
      const searchDir = path.join(tmpSearch, 'search', 'es');
      fs.mkdirSync(searchDir, { recursive: true });
      const searchFiles = {
        'manifest.json': JSON.stringify({
          version: '0.1.0',
          schema: 1,
          locale: 'es',
          topicCount: 0,
          files: {
            topics: 'topics.json',
            postings: 'topic-postings.json',
            termTopics: 'term-topics.json',
          },
        }),
        'topics.json': JSON.stringify({ topics: [] }),
        'topic-postings.json': JSON.stringify({
          version: 1,
          locale: 'es',
          postings: {},
        }),
        'term-topics.json': JSON.stringify({
          version: 1,
          locale: 'es',
          terms: {},
        }),
      };
      for (const [name, body] of Object.entries(searchFiles)) {
        fs.writeFileSync(path.join(searchDir, name), body);
      }
      fs.writeFileSync(
        path.join(tmpSearch, 'search', 'search-manifest.json'),
        JSON.stringify({ version: '0.1.0', schema: 1, locales: { es: 'es' } }),
      );
      // decoy meta under search must not be deleted
      fs.writeFileSync(
        path.join(searchDir, 'meta.json'),
        JSON.stringify({ keep: true }),
      );

      compressCorpusTree(tmpSearch, { keepMeta: false });

      for (const name of Object.keys(searchFiles)) {
        assert.ok(
          fs.existsSync(path.join(searchDir, name)),
          `search/es/${name} must survive compress`,
        );
      }
      assert.ok(
        fs.existsSync(path.join(tmpSearch, 'search', 'search-manifest.json')),
        'search-manifest.json must survive',
      );
      assert.ok(
        fs.existsSync(path.join(searchDir, 'meta.json')),
        'meta.json under search/ must not be stripped',
      );
      console.log('  search/ pack preserved OK');
    } finally {
      fs.rmSync(tmpSearch, { recursive: true, force: true });
    }
  }

  section('package scripts hook the prescript before freezing deliverables');
  for (const [label, file] of [
    ['package-web.sh', PACKAGE_WEB],
    ['package-apk.sh', PACKAGE_APK],
    ['package-electron.sh', PACKAGE_ELECTRON],
  ]) {
    const body = fs.readFileSync(file, 'utf8');
    assert.ok(
      body.includes('corpus-compress'),
      `${label} must invoke corpus-compress`,
    );
    assert.ok(
      body.includes('assets/corpus') || body.includes('corpus-compress.js'),
      `${label} must target ship corpus path`,
    );
    console.log(`  ${label} hooks corpus-compress`);
  }
  // package-all delegates to package-web (which compresses)
  const allBody = fs.readFileSync(PACKAGE_ALL, 'utf8');
  assert.ok(
    allBody.includes('package-web.sh'),
    'package-all must call package-web (compress on web path)',
  );
  console.log('  package-all.sh → package-web.sh OK');

  section('bible sample when present (index_array + empty refs)');
  const bibleContent = path.join(
    ASSETS,
    'documents',
    'bible-pueblo-de-dios-es',
    'content.json',
  );
  if (fs.existsSync(bibleContent)) {
    // Only transform first chunk via pure API — full bible is large; use first 500 units from file by parsing stream is heavy, so use compressJsonValue on a slice loaded partially
    // Load full is ok for test correctness if memory allows; limit to reading via pure buffer of a fixture built from head units
    const all = JSON.parse(fs.readFileSync(bibleContent, 'utf8'));
    const slice = all.slice(0, 500);
    assert.ok(slice.some((u) => u.index_array != null || u.referencias?.length === 0));
    const raw = Buffer.from(JSON.stringify(slice), 'utf8');
    const { output, parsed } = compressJsonBuffer(raw, 'content.json');
    assert.ok(output.length < raw.length, 'bible slice must shrink');
    const a = readingSnapshot(slice);
    const b = readingSnapshot(parsed);
    assert.strictEqual(a.unitCount, b.unitCount);
    assert.strictEqual(a.units[0].contenido, b.units[0].contenido);
    assert.strictEqual(a.units[0].consecutivo, b.units[0].consecutivo);
    console.log(
      `  bible slice 500: ${raw.length} → ${output.length} (−${raw.length - output.length} B)`,
    );
  } else {
    console.log('  bible pack absent — skipped');
  }

  console.log('\nAll corpus-compress tests passed.');
}

main();
