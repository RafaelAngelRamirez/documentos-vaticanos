/**
 * Run: node --experimental-strip-types papacy_slug.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'src/papacy/slug.ts')).href + `?t=${Date.now()}`
  );
  const used = new Set();
  assert.strictEqual(
    mod.slugFromFilename('hf_ben-xvi_enc_20090629_caritas-in-veritate.html'),
    'caritas-in-veritate',
  );
  assert.strictEqual(
    mod.slugFromFilename('papa-francesco_20150524_enciclica-laudato-si.html'),
    'laudato-si',
  );
  const id = mod.corpusDocIdFor(
    'https://www.vatican.va/content/francesco/es/encyclicals/documents/papa-francesco_20150524_enciclica-laudato-si.html',
    'es',
    used,
  );
  assert.strictEqual(id, 'laudato-si-es');
  const id2 = mod.corpusDocIdFor(
    'https://www.vatican.va/content/francesco/en/encyclicals/documents/papa-francesco_20150524_enciclica-laudato-si.html',
    'en',
    used,
  );
  assert.strictEqual(id2, 'laudato-si-en');
  console.log('OK papacy slug');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
