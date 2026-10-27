/**
 * Estantes, lemas, BM25 y el índice compacto por paquete.
 *
 * Desde frontend/:
 *   bash ../scripts/node-strip-types.sh src/app/core/search/shelf-search.logic.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const {
  foldToken,
  shelfOf,
  lemasDe,
  bm25,
  idf,
  columnasPorEstante,
  keepIndexTerm,
  encodeShelfPackage,
  decodeShelfPackage,
  corpusDf,
  resolveEnabledShelves,
  defaultEnabledShelves,
  emptyShelfMessage,
  looksLikeIndexUnit,
  postingUnitCount,
} = require('./shelf-search.logic.ts');

const BUSCADOR = path.resolve(
  __dirname,
  '../../components/buscador/buscador.component.ts',
);
const PACKAGES = path.resolve(
  __dirname,
  '../../../../../documentos/corpus/search/packages',
);
const ASSETS = path.resolve(
  __dirname,
  '../../../assets/corpus/search/packages',
);

function hit(partial) {
  return {
    documentId: 'x',
    unitIndex: 1,
    score: 1,
    official: true,
    ai: false,
    toc: false,
    via: 'palabra',
    matchedTerms: ['eucaristia'],
    shelf: 'catecismo',
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
      'https://www.vatican.va/content/john-xxiii/es/motu_proprio/documents/hf_j-xxiii_motu-proprio_19620806_appropinquante-concilio.html',
  }),
  'magisterio',
);
assert.strictEqual(
  shelfOf({
    id: 'en-es',
    locale: 'es',
    kind: 'magisterium',
    title: 'Evangelii nuntiandi',
    sourceUrl:
      'https://www.vatican.va/content/paul-vi/es/apost_exhortations/documents/hf_p-vi_exh_19751208_evangelii-nuntiandi.html',
  }),
  'exhortacion',
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
  shelfOf({
    id: 'nicea-i-es',
    locale: 'es',
    kind: 'council',
    translationProvenance: 'ai',
  }),
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
      ai: true,
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
      ai: true,
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
  {
    shelves: [
      'catecismo',
      'codigo',
      'concilio',
      'enciclica',
      'padres',
      'biblia',
    ],
  },
);

assert.deepStrictEqual(
  columns.catecismo.map((row) => row.documentId + ':' + row.unitIndex),
  ['cic-es:1388', 'cic-es:1324'],
);
assert.strictEqual(columns.concilio[0].documentId, 'sc-es');
assert.strictEqual(columns.concilio[1].documentId, 'nicea-i-es');
assert.strictEqual(columns.codigo[0].unitIndex, 919);
assert.strictEqual(columns.enciclica[0].documentId, 'ee-es');
assert.strictEqual(
  columns.padres[0].documentId,
  'cirilo-jerusalen-catequesis-es',
);
assert.deepStrictEqual(
  columns.biblia.map((row) => row.documentId),
  ['bible-pueblo-de-dios-es'],
);

const sinBiblia = columnasPorEstante(
  [hit({ shelf: 'catecismo', documentId: 'cic-es', score: 3, unitIndex: 1 })],
  { shelves: ['catecismo', 'biblia'] },
);
assert.deepStrictEqual(sinBiblia.biblia, []);
assert.strictEqual(sinBiblia.catecismo.length, 1);

assert.strictEqual(keepIndexTerm('eucaristico51', 'padres'), false);
assert.strictEqual(keepIndexTerm('eucaristico', 'padres'), true);
assert.strictEqual(keepIndexTerm('eucaristico51', 'base'), true);

assert.deepStrictEqual(defaultEnabledShelves(['base']), [
  'catecismo',
  'codigo',
  'concilio',
  'enciclica',
  'biblia',
]);
assert.ok(defaultEnabledShelves(['base', 'padres']).includes('padres'));
assert.deepStrictEqual(
  resolveEnabledShelves(JSON.stringify(['biblia']), ['base', 'padres']),
  ['biblia'],
);
assert.deepStrictEqual(
  resolveEnabledShelves(JSON.stringify(['padres', 'catecismo']), ['base']),
  ['catecismo'],
);

const vacia = emptyShelfMessage('biblia', 'eucaristia', 'es', ['base']);
assert.strictEqual(vacia.message, 'No hay ninguna unidad.');
assert.deepStrictEqual(
  vacia.alternatives.map((alt) => alt.term),
  ['cena', 'caliz'],
);
assert.strictEqual(
  emptyShelfMessage('padres', 'eucaristia', 'es', ['base']).message,
  'Estas obras no están en el aparato.',
);
assert.strictEqual(
  emptyShelfMessage('catecismo', 'eucaristia', 'es', ['base']).message,
  'No hay ninguna unidad.',
);
assert.strictEqual(
  looksLikeIndexUnit('Índice general ............ 12'),
  true,
);
assert.strictEqual(
  looksLikeIndexUnit('La eucaristía es el sacramento del altar.'),
  false,
);

const bytes = encodeShelfPackage({
  locale: 'es',
  packageId: 'base',
  avgTokens: { catecismo: 75.6, codigo: 74.7 },
  docs: [
    {
      id: 'cic-es',
      shelf: 'catecismo',
      official: true,
      ai: false,
      unitCount: 10,
    },
    {
      id: 'cdc-es',
      shelf: 'codigo',
      official: true,
      ai: false,
      unitCount: 8,
    },
  ],
  terms: new Map([
    [
      'eucaristia',
      new Map([
        [0, [3, 8]],
        [1, [1]],
      ]),
    ],
  ]),
});
const decoded = decodeShelfPackage(bytes);
assert.strictEqual(decoded.packageId, 'base');
assert.strictEqual(decoded.docs[1].id, 'cdc-es');
assert.deepStrictEqual(decoded.terms.get('eucaristia').groups[0].units, [3, 8]);
assert.strictEqual(postingUnitCount(decoded, 'eucaristia').units, 3);

const other = decodeShelfPackage(
  encodeShelfPackage({
    locale: 'es',
    packageId: 'padres',
    avgTokens: { padres: 181.8 },
    docs: [
      {
        id: 'agustin-es',
        shelf: 'padres',
        official: true,
        ai: false,
        unitCount: 4,
      },
    ],
    terms: new Map([['eucaristia', new Map([[0, [2]]])]]),
  }),
);
const merged = corpusDf([decoded, other], 'eucaristia');
assert.strictEqual(merged.n, 3);
assert.strictEqual(merged.df, 3);

const buscador = fs.readFileSync(BUSCADOR, 'utf8');
assert.ok(
  buscador.includes('shelf-search.logic'),
  'el buscador usa la búsqueda por estantes',
);
assert.ok(
  buscador.includes('rankUnitsForDocument'),
  'la búsqueda por punto sigue en el índice de la obra',
);

function readPkg(name) {
  const file = path.join(PACKAGES, name);
  assert.ok(fs.existsSync(file), name);
  const asset = path.join(ASSETS, name);
  const raw = fs.readFileSync(file);
  const copy = fs.readFileSync(asset);
  assert.strictEqual(raw.length, copy.length, `${name} distinto en assets`);
  return raw;
}

const medicion = JSON.parse(
  fs.readFileSync(path.join(PACKAGES, 'medicion.json'), 'utf8'),
);
const baseInfo = medicion.packages.find((pkg) => pkg.id === 'base');
const padresInfo = medicion.packages.find((pkg) => pkg.id === 'padres');
assert.ok(baseInfo.rawBytes > 0 && baseInfo.rawBytes <= 16_000_000);
assert.ok(baseInfo.gzipBytes > 0 && baseInfo.gzipBytes <= 8_000_000);
assert.ok(baseInfo.buildMs > 0);
assert.ok(baseInfo.lookupUs >= 0 && baseInfo.lookupUs < 100_000);
assert.ok(padresInfo.rawBytes > 0 && padresInfo.rawBytes <= 32_000_000);
assert.ok(padresInfo.gzipBytes > 0 && padresInfo.gzipBytes <= 16_000_000);

const base = decodeShelfPackage(readPkg('es-base.dvix'));
assert.strictEqual(base.packageId, 'base');
assert.strictEqual(base.locale, 'es');
assert.strictEqual(base.docs.length, baseInfo.docs);
assert.ok(base.docs.some((doc) => doc.id === 'cic-es' && doc.shelf === 'catecismo'));
assert.ok(base.docs.some((doc) => doc.id === 'cdc-es' && doc.shelf === 'codigo'));
assert.ok(base.docs.some((doc) => doc.id === 'sc-es' && doc.shelf === 'concilio'));
assert.ok(base.docs.some((doc) => doc.id === 'ee-es' && doc.shelf === 'enciclica'));
assert.ok(
  base.docs.some(
    (doc) => doc.id === 'bible-pueblo-de-dios-es' && doc.shelf === 'biblia',
  ),
);
assert.ok(!base.docs.some((doc) => doc.shelf === 'padres'));
assert.ok(!base.docs.some((doc) => doc.id === 'catecismo-romano-es'));
assert.ok(!base.docs.some((doc) => doc.id === 'cceo-es'));
assert.ok(!base.docs.some((doc) => doc.id.startsWith('nicea')));
assert.ok(postingUnitCount(base, 'eucaristia').units > 0);
assert.strictEqual(fs.statSync(path.join(PACKAGES, 'es-base.dvix')).size, baseInfo.rawBytes);

const padres = decodeShelfPackage(readPkg('es-padres.dvix'));
assert.strictEqual(padres.packageId, 'padres');
assert.ok(padres.docs.length > 0);
assert.ok(padres.docs.every((doc) => doc.shelf === 'padres'));
for (const term of padres.terms.keys()) {
  assert.strictEqual(/[0-9]/.test(term), false, term);
}
assert.strictEqual(
  fs.statSync(path.join(PACKAGES, 'es-padres.dvix')).size,
  padresInfo.rawBytes,
);

console.log(
  `shelf-search.logic.test.js ok base ${baseInfo.rawBytes} gzip ${baseInfo.gzipBytes} lookup ${baseInfo.lookupUs}µs padres ${padresInfo.rawBytes}`,
);
