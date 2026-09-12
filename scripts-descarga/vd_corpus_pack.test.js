/**
 * Verbum Domini (vd-es) dual-written pack + lectio divina units 86–87.
 * Distinct from dv-es (Dei Verbum).
 *
 * Run: node scripts-descarga/vd_corpus_pack.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOTS = [
  path.join(REPO, 'documentos/corpus'),
  path.join(REPO, 'frontend/src/assets/corpus'),
];

function main() {
  const sources = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config/sources.json'), 'utf8'),
  );
  const vd = (sources.sources || []).find((s) => s.id === 'vd');
  assert.ok(vd, 'sources.json has id=vd');
  assert.strictEqual(vd.corpusDocId, 'vd-es');
  assert.notStrictEqual(vd.corpusDocId, 'dv-es');
  assert.strictEqual(vd.docCode, 'VD');
  assert.ok(/verbum-domini/i.test(vd.seedUrls[0]));
  assert.ok(
    fs.existsSync(path.join(__dirname, 'fixtures/vd-es/source.html')),
    'fixture HTML',
  );

  for (const root of ROOTS) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
    );
    const docs = manifest.documents || [];
    const meta = docs.find((d) => d.id === 'vd-es');
    const dv = docs.find((d) => d.id === 'dv-es');
    assert.ok(meta, `vd-es in manifest ${root}`);
    assert.ok(dv, `dv-es still Dei Verbum in ${root}`);
    assert.ok(/Dei\s+verbum/i.test(dv.title || ''), 'dv-es is Dei Verbum');
    assert.ok(/Verbum\s+Domini/i.test(meta.title || ''), 'vd-es title');
    assert.strictEqual(meta.shortTitle, 'VD');
    assert.strictEqual(meta.locale, 'es');
    assert.ok(meta.sourceUrl && /verbum-domini/i.test(meta.sourceUrl));
    assert.ok(meta.unitCount >= 120, `unitCount ${meta.unitCount}`);

    const units = JSON.parse(
      fs.readFileSync(path.join(root, 'documents/vd-es/content.json'), 'utf8'),
    );
    assert.strictEqual(units.length, meta.unitCount);
    const by = Object.fromEntries(
      units.map((u) => [String(u.consecutivo), u]),
    );
    assert.ok(by['86'], 'unit 86');
    assert.ok(by['87'], 'unit 87');
    assert.ok(
      /lectio divina/i.test(by['86'].contenido || ''),
      '§86 names lectio divina',
    );
    assert.ok(
      /lectio divina/i.test(by['87'].contenido || ''),
      '§87 names lectio divina',
    );
    assert.ok(
      /contemplatio|contemplaci[oó]n|actio/i.test(by['87'].contenido || ''),
      '§87 has contemplatio/actio steps',
    );
  }

  console.log(JSON.stringify({ ok: true, id: 'vd-es', units: 124 }));
}

main();
