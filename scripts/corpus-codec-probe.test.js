/**
 * Round-trip and read-only checks for scripts/corpus-codec-probe.js.
 *
 *   node scripts/corpus-codec-probe.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  textFingerprint,
  shipBodyPieces,
  measureCodec,
  CODECS,
  CEILING_CODECS,
  probeRoot,
} = require('./corpus-codec-probe.js');
const { serializeCompact } = require('./corpus-compress.js');

function section(name) {
  console.log(`\n== ${name} ==`);
}

function unit(contenido, extra) {
  return { consecutivo: '1', contenido, referencias: [], ...extra };
}

section('text fingerprint ignores empty refs and newline shape');
{
  const a = [unit('Padre\r\nnuestro'), unit('amén')];
  const b = [
    { consecutivo: '1', contenido: 'Padre\nnuestro' },
    { consecutivo: '1', contenido: 'amén', referencias: [{ obra: 'x' }] },
  ];
  assert.strictEqual(textFingerprint(a), textFingerprint(b));
  assert.notStrictEqual(textFingerprint(a), textFingerprint([unit('Padre nuestro')]));
}

section('ship pieces match the chunk contract');
{
  const units = [1, 2, 3, 4, 5].map((n) => unit(`u${n}`, { consecutivo: String(n) }));
  const one = shipBodyPieces(units, 10);
  assert.deepStrictEqual(one.map((p) => p.name), ['content.json']);
  assert.strictEqual(one[0].opens, true);
  const split = shipBodyPieces(units, 2);
  assert.deepStrictEqual(
    split.map((p) => p.name),
    ['chunks.json', 'c/0.json', 'c/1.json', 'c/2.json'],
  );
  assert.strictEqual(split[1].opens, true);
  assert.strictEqual(split[2].opens, false);
  const spec = JSON.parse(split[0].buf.toString('utf8'));
  assert.deepStrictEqual(spec, { v: 1, chunkSize: 2, unitCount: 5 });
  const rebuilt = split.slice(1).flatMap((p) => JSON.parse(p.buf.toString('utf8')));
  assert.strictEqual(textFingerprint(rebuilt), textFingerprint(units));
  assert.strictEqual(split[1].buf.equals(serializeCompact(units.slice(0, 2))), true);
}

section('deflate brotli and zstd round-trip the same bytes');
{
  const buf = serializeCompact([
    unit('Lumen gentium §1. El texto no cambia.'),
    unit('第二段'),
  ]);
  for (const codec of [...CODECS, ...CEILING_CODECS]) {
    const measured = measureCodec(buf, codec, () => {});
    assert.strictEqual(measured.equal, true, codec.name);
    assert.ok(measured.bytes > 0, codec.name);
    assert.ok(measured.bytes < buf.length, codec.name);
    const parsed = measured.parsed;
    assert.strictEqual(textFingerprint(parsed), textFingerprint(JSON.parse(buf.toString('utf8'))));
  }
}

section('probeRoot does not write the corpus');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-codec-probe-'));
  const docDir = path.join(root, 'documents', 'lg-es');
  fs.mkdirSync(docDir, { recursive: true });
  const content = serializeCompact([
    unit('texto\r\ncanónico'),
    unit('sigue'),
    unit('tres'),
  ]);
  const index = serializeCompact({
    indice: { dios: [1, 2], lumen: [0] },
    indice_por_punto: { 0: 0 },
  });
  fs.writeFileSync(path.join(docDir, 'content.json'), content);
  fs.writeFileSync(path.join(docDir, 'index.json'), index);
  fs.writeFileSync(path.join(docDir, 'meta.json'), '{"id":"lg-es"}\n');
  const longDir = path.join(root, 'documents', 'largo-es');
  fs.mkdirSync(longDir, { recursive: true });
  const longUnits = [];
  for (let i = 0; i < 501; i += 1) {
    longUnits.push({ consecutivo: String(i + 1), contenido: `n${i}`, referencias: [] });
  }
  const longContent = serializeCompact(longUnits);
  const longIndex = serializeCompact({ indice: { dios: [0] }, indice_por_punto: {} });
  fs.writeFileSync(path.join(longDir, 'content.json'), longContent);
  fs.writeFileSync(path.join(longDir, 'index.json'), longIndex);
  const manifest = {
    documents: [
      { id: 'lg-es', kind: 'magisterium', locale: 'es', translationProvenance: 'official' },
      { id: 'largo-es', kind: 'patristic', locale: 'es' },
      { id: 'ghost-ai', kind: 'magisterium', locale: 'es', translationProvenance: 'ai' },
    ],
  };
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest));
  const before = {
    content: fs.readFileSync(path.join(docDir, 'content.json')),
    index: fs.readFileSync(path.join(docDir, 'index.json')),
    meta: fs.readFileSync(path.join(docDir, 'meta.json')),
    manifest: fs.readFileSync(path.join(root, 'manifest.json')),
    longContent: fs.readFileSync(path.join(longDir, 'content.json')),
  };
  const report = probeRoot(root, 1);
  assert.strictEqual(report.keptDocs, 2);
  assert.strictEqual(report.aiDocs, 1);
  assert.strictEqual(report.textHashMismatches, 0);
  assert.strictEqual(report.byteMismatches, 0);
  assert.strictEqual(report.diskMismatches, 0);
  assert.strictEqual(report.chunkedDocs, 1);
  assert.ok(before.longContent.equals(fs.readFileSync(path.join(longDir, 'content.json'))));
  assert.ok(report.index.codecs['brotli-5'].bytes > 0);
  assert.ok(report.index.codecs['zstd-3'].bytes > 0);
  assert.ok(report.index.codecs['deflate-6'].bytes > 0);
  const after = {
    content: fs.readFileSync(path.join(docDir, 'content.json')),
    index: fs.readFileSync(path.join(docDir, 'index.json')),
    meta: fs.readFileSync(path.join(docDir, 'meta.json')),
    manifest: fs.readFileSync(path.join(root, 'manifest.json')),
  };
  assert.ok(before.content.equals(after.content));
  assert.ok(before.index.equals(after.index));
  assert.ok(before.meta.equals(after.meta));
  assert.ok(before.manifest.equals(after.manifest));
  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\nok');
