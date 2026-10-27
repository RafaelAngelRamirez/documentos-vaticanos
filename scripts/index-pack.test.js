/**
 * Ship index pack: classic postings roundtrip, and the frontend decoder
 * matches scripts/index-pack.js.
 *
 *   node scripts/index-pack.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  packIndex,
  packIndexBuffer,
  unpackIndex,
  sameIndex,
} = require('./index-pack.js');

const ROOT = path.resolve(__dirname, '..');
const LOGIC = path.join(
  ROOT,
  'frontend/src/app/core/corpus/corpus-load.logic.ts',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('synthetic roundtrip');
  const classic = {
    indice: {
      cristo: [0, 2, 5],
      vacío: [],
      'año': [1],
    },
    indice_por_punto: { 0: 1, 1: null, 2: 4 },
  };
  const buf = packIndexBuffer(classic);
  assert.ok(buf);
  const back = unpackIndex(JSON.parse(buf.toString('utf8')));
  assert.ok(back && sameIndex(classic, back));
  assert.strictEqual(packIndex({ indice: { 'a\tb': [1] } }), null);

  const sparse = {
    indice: { dios: [3, 4] },
    indice_por_punto: { 41: 12, 46: 13 },
  };
  const sparseBuf = packIndexBuffer(sparse);
  assert.ok(sparseBuf);
  const sparseBack = unpackIndex(JSON.parse(sparseBuf.toString('utf8')));
  assert.ok(sparseBack && sameIndex(sparse, sparseBack));
  assert.ok(!Array.isArray(JSON.parse(sparseBuf.toString('utf8')).p));
  assert.strictEqual(typeof JSON.parse(sparseBuf.toString('utf8')).p, 'object');

  section('frontend unpackShipIndex matches');
  const mod = await import(pathToFileURL(LOGIC).href);
  const unpackShipIndex = mod.unpackShipIndex;
  assert.strictEqual(typeof unpackShipIndex, 'function');

  const ids = ['lg-es', 'cic-es', 'dv-es'];
  for (const id of ids) {
    const file = path.join(ROOT, 'documentos/corpus/documents', id, 'index.json');
    const classicIdx = JSON.parse(fs.readFileSync(file, 'utf8'));
    const packed = JSON.parse(packIndexBuffer(classicIdx).toString('utf8'));
    const fromJs = unpackIndex(packed);
    const fromTs = unpackShipIndex(packed);
    assert.ok(fromJs && sameIndex(classicIdx, fromJs), id);
    assert.ok(fromTs && sameIndex(classicIdx, fromTs), `${id} ts`);
    assert.ok(sameIndex(fromJs, fromTs), `${id} js/ts`);
    console.log(`  ${id} ok`);
  }

  assert.strictEqual(unpackShipIndex({ indice: { a: [1] } }), null);
  console.log('\nAll index-pack tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
