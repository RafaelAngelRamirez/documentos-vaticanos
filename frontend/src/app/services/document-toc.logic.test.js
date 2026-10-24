/**
 * Document TOC / Índice builder — drives the shipped pure module.
 * Run: node --experimental-strip-types src/app/services/document-toc.logic.test.js
 *
 * Bare relative imports in shipped .ts (e.g. `./speech-prep.logic`) need a
 * resolve hook under Node ESM + strip-types.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

// Resolve extensionless relative imports to sibling .ts files (shipped style).
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
          } catch {
            // fall through
          }
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const HERE = __dirname;
const LOGIC = path.join(HERE, 'document-toc.logic.ts');
const DETALLE_TS = path.resolve(
  HERE,
  '../pages/documento-detalle/documento-detalle.component.ts',
);
const DETALLE_HTML = path.resolve(
  HERE,
  '../pages/documento-detalle/documento-detalle.component.html',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

/** Multi-heading / multi-part fixture (CIC-like running headers). */
function multiHeadingFixture() {
  return [
    { consecutivo: 'no-encontrado', contenido: 'CARTA APOSTÓLICA' },
    {
      consecutivo: 'no-encontrado',
      contenido: 'Primera parte: la profesión de la fe',
    },
    { consecutivo: '1', contenido: '1. El deseo de Dios está inscrito…' },
    {
      consecutivo: 'no-encontrado',
      contenido: 'PRIMERA PARTE LA PROFESIÓN DE LA FE',
    },
    {
      consecutivo: 'no-encontrado',
      contenido: 'PRIMERA SECCIÓN «CREO»-«CREEMOS»',
    },
    {
      consecutivo: 'no-encontrado',
      contenido: 'CAPÍTULO PRIMERO: EL HOMBRE ES CAPAZ DE DIOS',
    },
    { consecutivo: '27', contenido: '27. El deseo de Dios…' },
    // Running header repeat (must dedupe)
    {
      consecutivo: 'no-encontrado',
      contenido: 'PRIMERA PARTE LA PROFESIÓN DE LA FE',
    },
    {
      consecutivo: 'no-encontrado',
      contenido: 'PRIMERA SECCIÓN «CREO»-«CREEMOS»',
    },
    {
      consecutivo: 'no-encontrado',
      contenido: 'CAPÍTULO SEGUNDO DIOS AL ENCUENTRO DEL HOMBRE',
    },
    { consecutivo: '50', contenido: '50. Por la razón natural…' },
    {
      consecutivo: 'no-encontrado',
      contenido: 'Segunda parte: Los sacramentos de la fe',
    },
    {
      consecutivo: 'no-encontrado',
      contenido: 'SEGUNDA PARTE LA CELEBRACIÓN DEL MISTERIO CRISTIANO',
    },
    { consecutivo: '1066', contenido: '1066. En el Símbolo…' },
  ];
}

/** Bible-like multi-book sample. */
function bibleLikeFixture() {
  return [
    {
      consecutivo: '0',
      contenido: 'Título Génesis',
      biblia: {
        libro: 'genesis',
        consecutivo_versiculo: 'Gn 0, 0',
        capitulo: '0',
      },
    },
    {
      consecutivo: '1',
      contenido: '1 Al principio…',
      biblia: {
        libro: 'genesis',
        consecutivo_versiculo: 'Gn 1, 1',
        capitulo: '1',
      },
    },
    {
      consecutivo: '2',
      contenido: '2 La tierra era…',
      biblia: {
        libro: 'genesis',
        consecutivo_versiculo: 'Gn 1, 2',
        capitulo: '1',
      },
    },
    {
      consecutivo: '100',
      contenido: 'Título Éxodo',
      biblia: {
        libro: 'exodo',
        consecutivo_versiculo: 'Ex 0, 0',
        capitulo: '0',
      },
    },
    {
      consecutivo: '101',
      contenido: '1 Estos son los nombres…',
      biblia: {
        libro: 'exodo',
        consecutivo_versiculo: 'Ex 1, 1',
        capitulo: '1',
      },
    },
    {
      consecutivo: '200',
      contenido: 'Título Mateo',
      biblia: {
        libro: 'evangelio segun san mateo',
        consecutivo_versiculo: 'Mt 0, 0',
        capitulo: '0',
      },
    },
    {
      consecutivo: '201',
      contenido: '1 Genealogía…',
      biblia: {
        libro: 'evangelio segun san mateo',
        consecutivo_versiculo: 'Mt 1, 1',
        capitulo: '1',
      },
    },
  ];
}

/** Flat numbered magisterium (DV-like) — no structural headings. */
function flatNumberedFixture() {
  return [
    {
      consecutivo: '1',
      contenido:
        '1. El Santo Concilio, escuchando religiosamente la palabra de Dios y proclamándola confiadamente, hace suya la frase de San Juan.',
    },
    {
      consecutivo: '2',
      contenido:
        '2. Dispuso Dios en su sabiduría revelarse a Sí mismo y dar a conocer el misterio de su voluntad.',
    },
    {
      consecutivo: '3',
      contenido:
        '3. Dios, creándolo todo y conservándolo por su Verbo, da a los hombres testimonio perenne de sí en las cosas creadas.',
    },
    {
      consecutivo: '7',
      contenido:
        '7. Dios quiso que lo que había revelado para salvación de todos los pueblos se conservara íntegro.',
    },
  ];
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC), 'document-toc.logic.ts exists');
  assert.ok(fs.existsSync(DETALLE_TS), 'documento-detalle.component.ts exists');
  assert.ok(fs.existsSync(DETALLE_HTML), 'documento-detalle.component.html exists');

  const detalleTs = fs.readFileSync(DETALLE_TS, 'utf8');
  const detalleHtml = fs.readFileSync(DETALLE_HTML, 'utf8');
  assert.ok(
    detalleTs.includes('document-toc.logic') ||
      detalleTs.includes('buildDocumentToc'),
    'document-detail imports/uses buildDocumentToc',
  );
  assert.ok(
    detalleTs.includes('unitIndex') &&
      (detalleTs.includes('openChapter') ||
        detalleTs.includes('irACapitulo') ||
        detalleTs.includes('irALector')),
    'document-detail can open reader at unitIndex',
  );
  assert.ok(
    detalleHtml.includes('class="toc"') || detalleHtml.includes("class='toc'"),
    'template still renders .toc',
  );
  // Hard-coded map of a few IDs must not be the exclusive source
  assert.ok(
    !detalleTs.includes("'ls-es'") || detalleTs.includes('buildDocumentToc'),
    'hard-coded-only chapter map is not the exclusive source',
  );
  assert.ok(
    !/known:\s*Record<string,\s*\{\s*num:\s*string;\s*title:\s*string\s*\}/.test(
      detalleTs,
    ),
    'old hard-coded chapters getter without unitIndex is gone',
  );

  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const {
    buildDocumentToc,
    buildBibleBookToc,
    buildHeadingToc,
    formatBibleBookTitle,
    formatHeadingEntry,
    normalizeTocLabel,
    CURATED_TOC_OVERRIDES,
  } = mod;

  section('multi-heading fixture (parts + chapters, dedupe)');
  const multi = multiHeadingFixture();
  const multiToc = buildDocumentToc(multi, { documentId: 'fixture-cic' });
  assert.ok(multiToc.length >= 2, `multi TOC has landmarks, got ${multiToc.length}`);
  // First unique PART appears
  const partKeys = multiToc.map((e) => normalizeTocLabel(e.title + ' ' + e.num));
  assert.ok(
    multiToc.some((e) => /profesi[oó]n/i.test(e.title) || e.num === 'I'),
    'includes first part landmark',
  );
  // Running header not duplicated
  const titles = multiToc.map((e) => normalizeTocLabel(e.title));
  const uniq = new Set(titles);
  assert.strictEqual(
    titles.length,
    uniq.size,
    'no duplicate titles after dedupe',
  );
  // Every entry has a valid unitIndex into the fixture
  for (const e of multiToc) {
    assert.ok(
      Number.isInteger(e.unitIndex) &&
        e.unitIndex >= 0 &&
        e.unitIndex < multi.length,
      `unitIndex in range: ${e.unitIndex}`,
    );
    assert.ok(e.title || e.num, 'entry has label');
  }
  // CAPÍTULO SEGUNDO must point at its first unit, not a later repeat
  const cap2 = multiToc.find((e) => /encuentro/i.test(e.title));
  if (cap2) {
    assert.strictEqual(
      cap2.unitIndex,
      9,
      `CAPÍTULO SEGUNDO unitIndex is first occurrence (got ${cap2.unitIndex})`,
    );
  }
  // Direct heading builder also dedupes
  const headingOnly = buildHeadingToc(multi);
  assert.ok(headingOnly.length >= 2, 'buildHeadingToc non-empty');
  assert.ok(
    headingOnly.filter((e) =>
      normalizeTocLabel(e.title).includes('profesi'),
    ).length <= 2,
    'profession-of-faith running header not spammed',
  );
  console.log(
    'multi TOC:',
    multiToc.map((e) => `${e.num}|${e.unitIndex}|${e.title.slice(0, 40)}`),
  );

  section('bible-like multi-book fixture');
  const bible = bibleLikeFixture();
  const bibleToc = buildDocumentToc(bible, {
    documentId: 'fixture-bible',
    kind: 'bible',
  });
  assert.strictEqual(bibleToc.length, 3, `3 books, got ${bibleToc.length}`);
  assert.strictEqual(bibleToc[0].unitIndex, 0, 'genesis starts at 0');
  assert.strictEqual(bibleToc[1].unitIndex, 3, 'exodo starts at 3');
  assert.strictEqual(bibleToc[2].unitIndex, 5, 'mateo starts at 5');
  assert.ok(/G[eé]nesis/i.test(bibleToc[0].title), 'genesis title');
  assert.ok(/[ÉE]xodo/i.test(bibleToc[1].title), 'exodo title');
  assert.ok(
    bibleToc[0].num.toLowerCase().includes('gn') || bibleToc[0].num === 'Gn',
    `genesis num from verse label, got ${bibleToc[0].num}`,
  );
  // buildBibleBookToc direct
  const books = buildBibleBookToc(bible);
  assert.deepStrictEqual(
    books.map((b) => b.unitIndex),
    [0, 3, 5],
  );
  console.log(
    'bible TOC:',
    bibleToc.map((e) => `${e.num}|${e.unitIndex}|${e.title}`),
  );

  section('flat numbered doc (empty / sparse, no crash)');
  const flat = flatNumberedFixture();
  const flatToc = buildDocumentToc(flat, { documentId: 'fixture-flat' });
  assert.ok(Array.isArray(flatToc), 'returns array');
  assert.strictEqual(
    flatToc.length,
    0,
    `flat body without headings → empty TOC, got ${flatToc.length}`,
  );
  // No throw on null/empty
  assert.deepStrictEqual(buildDocumentToc(null), []);
  assert.deepStrictEqual(buildDocumentToc([]), []);
  assert.deepStrictEqual(buildDocumentToc(undefined, { kind: 'magisterium' }), []);

  section('curated override only when auto empty');
  // Flat body long enough for DV chapter starts + documentId override
  const dvCurated = CURATED_TOC_OVERRIDES['dv-es'];
  assert.ok(dvCurated && dvCurated.length >= 4, 'dv-es curated exists');
  const longFlat = Array.from({ length: 26 }, (_, i) => ({
    consecutivo: String(i + 1),
    contenido: `${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.`,
  }));
  const flatWithCurated = buildDocumentToc(longFlat, { documentId: 'dv-es' });
  assert.ok(
    flatWithCurated.length >= 4,
    `curated fills in when content has no landmarks (got ${flatWithCurated.length})`,
  );
  for (const e of flatWithCurated) {
    assert.ok(
      Number.isInteger(e.unitIndex) &&
        e.unitIndex >= 0 &&
        e.unitIndex < longFlat.length,
      'curated unitIndex in body range',
    );
  }
  // Short flat: only curated entries with unitIndex < body length remain
  const shortCurated = buildDocumentToc(flat, { documentId: 'dv-es' });
  assert.ok(
    shortCurated.every((e) => e.unitIndex < flat.length),
    'out-of-range curated unitIndex dropped',
  );
  assert.ok(
    shortCurated.length < dvCurated.length,
    'short body keeps fewer curated rows than full override',
  );
  // When auto has landmarks, curated is NOT sole source (multi wins)
  const multiIgnoresCurated = buildDocumentToc(multi, {
    documentId: 'dv-es',
  });
  assert.ok(
    multiIgnoresCurated.some((e) => e.unitIndex === 1 || e.unitIndex === 3),
    'auto landmarks preferred over curated when present',
  );

  section('format helpers');
  assert.strictEqual(formatBibleBookTitle('genesis'), 'Genesis');
  assert.ok(
    /Primer libro de samuel/i.test(
      formatBibleBookTitle('primer libro de samuel'),
    ),
  );
  const fe = formatHeadingEntry('CAPÍTULO PRIMERO: EL HOMBRE ES CAPAZ DE DIOS', 0);
  assert.ok(fe.num && fe.title, 'formatHeadingEntry splits num/title');
  assert.ok(/hombre/i.test(fe.title), 'keeps chapter title text');

  section('ok');
  console.log('document-toc.logic.test.js: all passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
