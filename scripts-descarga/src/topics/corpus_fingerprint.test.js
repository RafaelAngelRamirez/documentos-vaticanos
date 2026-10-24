/**
 * Content-aware topic fingerprint tests.
 * Run: node scripts-descarga/src/topics/corpus_fingerprint.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

async function load() {
  // Prefer compiled-via-strip-types from sibling .ts when available
  const tsPath = path.join(__dirname, 'corpus_fingerprint.ts');
  if (fs.existsSync(tsPath)) {
    try {
      return await import(pathToFileURL(tsPath).href + `?t=${Date.now()}`);
    } catch {
      /* fall through to require after strip if runner uses it */
    }
  }
  // Direct require with experimental strip-types when node runs this via strip script
  return require('./corpus_fingerprint.ts');
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj));
}

async function main() {
  const F = await load();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'topic-fp-'));
  try {
    const docs = [
      {
        id: 'cic-es',
        locale: 'es',
        bodyPath: 'documents/cic-es/content.json',
        indexPath: 'documents/cic-es/index.json',
        unitCount: 2,
      },
      {
        id: 'lg-es',
        locale: 'es',
        bodyPath: 'documents/lg-es/content.json',
        indexPath: 'documents/lg-es/index.json',
        unitCount: 1,
      },
      {
        id: 'cic-en',
        locale: 'en',
        bodyPath: 'documents/cic-en/content.json',
        indexPath: 'documents/cic-en/index.json',
        unitCount: 2,
      },
    ];
    writeJson(path.join(tmp, 'manifest.json'), {
      version: 1,
      documents: docs,
    });
    writeJson(path.join(tmp, 'documents/cic-es/content.json'), [
      { consecutivo: '1', contenido: 'alpha' },
      { consecutivo: '2', contenido: 'beta' },
    ]);
    writeJson(path.join(tmp, 'documents/cic-es/index.json'), {
      indice: { alpha: [0] },
      indice_por_punto: {},
    });
    writeJson(path.join(tmp, 'documents/lg-es/content.json'), [
      { consecutivo: '1', contenido: 'lg body' },
    ]);
    writeJson(path.join(tmp, 'documents/lg-es/index.json'), {
      indice: { lg: [0] },
      indice_por_punto: {},
    });
    writeJson(path.join(tmp, 'documents/cic-en/content.json'), [
      { consecutivo: '1', contenido: 'en' },
    ]);
    writeJson(path.join(tmp, 'documents/cic-en/index.json'), {
      indice: {},
      indice_por_punto: {},
    });

    const a = F.computeLocaleCorpusFingerprint(tmp, docs, 'es');
    assert.strictEqual(a.algo, 'sha256');
    assert.strictEqual(a.docCount, 2);
    assert.strictEqual(a.value.length, 64);
    assert.strictEqual(a.valueShort, a.value.slice(0, 16));
    assert.ok(F.fingerprintsMatch(a.value, a));
    assert.ok(F.fingerprintsMatch(a.valueShort, a));
    assert.ok(!F.fingerprintsMatch('deadbeef', a));

    // OCR-style text change without unitCount change → fingerprint changes
    writeJson(path.join(tmp, 'documents/cic-es/content.json'), [
      { consecutivo: '1', contenido: 'alpha REPAIRED' },
      { consecutivo: '2', contenido: 'beta' },
    ]);
    const b = F.computeLocaleCorpusFingerprint(tmp, docs, 'es');
    assert.notStrictEqual(
      a.value,
      b.value,
      'content rewrite must change fingerprint',
    );

    // unitCount-only meta change without file rewrite still changes line
    // (unitCount is in the digest line) — but file same:
    const docs2 = docs.map((d) =>
      d.id === 'cic-es' ? { ...d, unitCount: 99 } : d,
    );
    // restore content to a's content for isolation
    writeJson(path.join(tmp, 'documents/cic-es/content.json'), [
      { consecutivo: '1', contenido: 'alpha' },
      { consecutivo: '2', contenido: 'beta' },
    ]);
    const c = F.computeLocaleCorpusFingerprint(tmp, docs2, 'es');
    // content same as a but unitCount differs → different FP
    assert.notStrictEqual(a.value, c.value);

    console.log('corpus_fingerprint tests OK', {
      a: a.valueShort,
      b: b.valueShort,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
