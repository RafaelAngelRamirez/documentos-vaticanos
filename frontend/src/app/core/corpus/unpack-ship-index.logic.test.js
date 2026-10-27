/**
 * APK decoder roundtrip for packs produced by scripts/index-pack.js.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/corpus/unpack-ship-index.logic.test.js
 * (from frontend/)
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const { packIndexBuffer, sameIndex } = require('../../../../../scripts/index-pack.js');

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  const logic = path.join(__dirname, 'corpus-load.logic.ts');
  const mod = await import(pathToFileURL(logic).href);
  const unpackShipIndex = mod.unpackShipIndex;
  assert.strictEqual(typeof unpackShipIndex, 'function');

  section('gaps, numeric terms, empty postings');
  const classic = {
    indice: {
      '1962': [0, 2, 5],
      '7': [],
      vacío: [],
      dios: [3],
    },
    indice_por_punto: { 41: 12, 46: null, 50: 13 },
  };
  const buf = packIndexBuffer(classic);
  assert.ok(buf);
  const packed = JSON.parse(buf.toString('utf8'));
  assert.strictEqual(packed.v, 2);
  assert.strictEqual(typeof packed.p, 'object');
  assert.ok(!Array.isArray(packed.p));
  const decoded = unpackShipIndex(packed);
  assert.ok(decoded && sameIndex(classic, decoded));

  section('dense points with a hole');
  const dense = {
    indice: { cristo: [1, 4] },
    indice_por_punto: { 0: 1, 1: null, 2: 4 },
  };
  const denseBuf = packIndexBuffer(dense);
  assert.ok(denseBuf);
  const densePacked = JSON.parse(denseBuf.toString('utf8'));
  assert.strictEqual(typeof densePacked.p, 'string');
  const denseDecoded = unpackShipIndex(densePacked);
  assert.ok(denseDecoded && sameIndex(dense, denseDecoded));

  section('a bad pack is not an index');
  assert.strictEqual(unpackShipIndex({ indice: { a: [1] } }), null);
  assert.strictEqual(unpackShipIndex({ v: 2, t: 1, p: '' }), null);
  assert.strictEqual(unpackShipIndex({ v: 2, t: 'dios\tnope', p: '' }), null);
  assert.strictEqual(unpackShipIndex({ v: 2, t: 'dios\t1', p: 'nope' }), null);

  console.log('\nAll unpack-ship-index tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
