/**
 * Estantes, lemas y BM25 de la búsqueda temática.
 *
 *   node scripts/busqueda-tematica.test.js
 */

'use strict';

const assert = require('assert');
const {
  foldToken,
  shelfOf,
  lemasDe,
  bm25,
  idf,
  columnasPorEstante,
} = require('./busqueda-tematica');

function hit(partial) {
  return {
    documentId: 'x',
    unitIndex: 1,
    score: 1,
    official: true,
    toc: false,
    ...partial,
  };
}

const folded = foldToken('Eucaristía');
assert.strictEqual(folded, 'eucaristia');
assert.strictEqual(foldToken('año'), 'año');

assert.deepStrictEqual(lemasDe('Eucaristía', 'es'), [
  'eucaristia',
  'eucaristica',
  'eucaristico',
  'eucaristicas',
  'eucaristicos',
  'eucaristias',
]);
assert.ok(!lemasDe('comunion', 'es').includes('comunidad'));
assert.ok(!lemasDe('hostia', 'es').includes('hostis'));
assert.deepStrictEqual(lemasDe('eucharist', 'en'), ['eucharist', 'eucharistic']);
assert.deepStrictEqual(lemasDe('感恩', 'zh'), ['感恩']);

assert.strictEqual(
  shelfOf({
    id: 'lg-es',
    locale: 'es',
    kind: 'magisterium',
    title: 'Lumen gentium',
  }),
  'concilio',
);
assert.strictEqual(
  shelfOf({
    id: 'ee-es',
    locale: 'es',
    kind: 'magisterium',
    title: 'Ecclesia de Eucharistia',
    sourceUrl:
      'https://www.vatican.va/content/john-paul-ii/es/encyclicals/documents/hf_jp-ii_enc_20030417_eccl-de-euch.html',
  }),
  'enciclica',
);
assert.strictEqual(
  shelfOf({
    id: 'appropinquante-concilio-es',
    locale: 'es',
    kind: 'magisterium',
    title: 'Appropinquante Concilio',
    sourceUrl:
      'https://www.vatican.va/content/john-xxiii/es/motu_proprio/documents/hf_j-xxiii_motu-proprio_19620606_appropinquante-concilio.html',
  }),
  'magisterio',
);
assert.strictEqual(
  shelfOf({ id: 'cdc-es', locale: 'es', kind: 'canon-law', title: 'Código' }),
  'codigo',
);
assert.strictEqual(
  shelfOf({ id: 'agustin-02-confesiones-es', locale: 'es', kind: 'patristic' }),
  'padres',
);
assert.strictEqual(
  shelfOf({ id: 'nicea-i-es', locale: 'es', kind: 'council', translationProvenance: 'ai' }),
  'concilio',
);

const rare = idf(427, 10);
const common = idf(427, 200);
assert.ok(rare > common);
const short = bm25(1, 40, 160, rare);
const long = bm25(1, 400, 160, rare);
assert.ok(short > long);

const columns = columnasPorEstante(
  [
    hit({
      shelf: 'catecismo',
      documentId: 'catecismo-romano-es',
      official: false,
      toc: true,
      score: 9,
      unitIndex: 3,
    }),
    hit({
      shelf: 'catecismo',
      documentId: 'cic-es',
      score: 2.5,
      unitIndex: 1388,
    }),
    hit({
      shelf: 'catecismo',
      documentId: 'cic-es',
      score: 2.2,
      unitIndex: 1324,
    }),
    hit({
      shelf: 'catecismo',
      documentId: 'cic-es',
      score: 2.1,
      unitIndex: 1327,
    }),
    hit({
      shelf: 'concilio',
      documentId: 'nicea-i-es',
      official: false,
      score: 8,
      unitIndex: 18,
    }),
    hit({
      shelf: 'concilio',
      documentId: 'sc-es',
      score: 1.4,
      unitIndex: 47,
    }),
    hit({
      shelf: 'codigo',
      documentId: 'cdc-es',
      score: 2,
      unitIndex: 919,
    }),
    hit({
      shelf: 'enciclica',
      documentId: 'ee-es',
      score: 2.4,
      unitIndex: 41,
    }),
    hit({
      shelf: 'padres',
      documentId: 'cirilo-jerusalen-catequesis-es',
      score: 2,
      unitIndex: 898,
    }),
    hit({
      shelf: 'biblia',
      documentId: 'bible-pueblo-de-dios-es',
      score: 3,
      unitIndex: 10,
    }),
  ],
  { shelves: ['catecismo', 'codigo', 'concilio', 'enciclica', 'padres', 'biblia'] },
);

assert.deepStrictEqual(
  columns.catecismo.map((h) => h.documentId + ':' + h.unitIndex),
  ['cic-es:1388', 'cic-es:1324'],
);
assert.strictEqual(columns.concilio[0].documentId, 'sc-es');
assert.strictEqual(columns.concilio[1].documentId, 'nicea-i-es');
assert.strictEqual(columns.codigo[0].unitIndex, 919);
assert.strictEqual(columns.enciclica[0].documentId, 'ee-es');
assert.strictEqual(columns.padres[0].documentId, 'cirilo-jerusalen-catequesis-es');
assert.deepStrictEqual(columns.biblia.map((h) => h.documentId), [
  'bible-pueblo-de-dios-es',
]);

const sinBiblia = columnasPorEstante(
  [hit({ shelf: 'catecismo', documentId: 'cic-es', score: 3, unitIndex: 1 })],
  { shelves: ['catecismo', 'biblia'] },
);
assert.deepStrictEqual(sinBiblia.biblia, []);
assert.strictEqual(sinBiblia.catecismo.length, 1);

console.log('busqueda-tematica.test.js ok');
