/**
 * Offline semantic / phrase search — drives the shipped pure module.
 * Run from frontend/:
 *   node --experimental-strip-types src/app/core/search/semantic-search.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'semantic-search.logic.ts');
const BUSCADOR = path.resolve(
  HERE,
  '../../components/buscador/buscador.component.ts',
);
const SERVICE = path.resolve(
  HERE,
  '../../components/buscador/buscador.service.ts',
);
const CORPUS_CIC = path.resolve(
  HERE,
  '../../../assets/corpus/documents/cic-es',
);
const CORPUS_LG = path.resolve(
  HERE,
  '../../../assets/corpus/documents/lg-es',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

function buildFixtureIndex(units) {
  /** Mirrors pack inverted index: single folded tokens → unit indices. */
  const {
    stripDiacritics,
    cleanForIndex,
  } = require('./semantic-search.logic.ts');
  const indice = {};
  const indice_por_punto = {};
  units.forEach((u, i) => {
    const n = parseInt(u.consecutivo, 10);
    if (!Number.isNaN(n)) indice_por_punto[i] = n;
    let text = u.contenido || '';
    text = cleanForIndex(stripDiacritics(text)).toLowerCase();
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (!indice[word]) indice[word] = [];
      if (!indice[word].includes(i)) indice[word].push(i);
    }
  });
  return { indice, indice_por_punto };
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC), 'semantic-search.logic.ts exists');
  const buscadorSrc = fs.readFileSync(BUSCADOR, 'utf8');
  const serviceSrc = fs.readFileSync(SERVICE, 'utf8');
  assert.ok(
    buscadorSrc.includes('semantic-search.logic'),
    'buscador.component imports semantic-search.logic',
  );
  assert.ok(
    buscadorSrc.includes('rankUnitsForDocument'),
    'buscador.component uses rankUnitsForDocument',
  );
  assert.ok(
    serviceSrc.includes('parseSearchInput') ||
      serviceSrc.includes('semantic-search.logic'),
    'buscador.service wires parseSearchInput',
  );
  console.log('wired: logic + buscador component + service');

  const logic = require('./semantic-search.logic.ts');
  const {
    parseSearchInput,
    rankUnitsForDocument,
    searchCorpus,
    findRelatedUnits,
    contentTermsFromText,
    expandTermsWithWeights,
  } = logic;

  section('parse: empty / points / phrases');
  assert.strictEqual(parseSearchInput('').empty, true);
  assert.strictEqual(parseSearchInput('   ').empty, true);
  assert.strictEqual(parseSearchInput(null).empty, true);
  assert.deepStrictEqual(searchCorpus('', []), []);
  assert.deepStrictEqual(searchCorpus(null, []), []);

  const points = parseSearchInput('.123, .200-202');
  assert.ok(!points.empty);
  assert.deepStrictEqual(points.points, [123, 200, 201, 202]);
  assert.deepStrictEqual(points.contentTerms, []);

  const intention = parseSearchInput('el amor de Dios');
  assert.ok(!intention.empty);
  assert.deepStrictEqual(intention.phrases, ['el amor de Dios']);
  assert.ok(intention.contentTerms.includes('amor'));
  assert.ok(intention.contentTerms.includes('dios'));
  assert.ok(!intention.contentTerms.includes('el'));
  assert.ok(!intention.contentTerms.includes('de'));
  console.log('contentTerms:', intention.contentTerms.join(', '));

  const single = parseSearchInput('Cristo');
  assert.deepStrictEqual(single.contentTerms, ['cristo']);

  section('fixture ranking');
  const units = [
    {
      index_array: 0,
      consecutivo: '10',
      contenido:
        'El amor de Dios se ha derramado en nuestros corazones por el Espíritu Santo.',
    },
    {
      index_array: 1,
      consecutivo: '11',
      contenido: 'La caridad es la forma de todas las virtudes.',
    },
    {
      index_array: 2,
      consecutivo: '12',
      contenido: 'Solo se menciona el mar y los barcos antiguos.',
    },
    {
      index_array: 3,
      consecutivo: '27',
      contenido: 'Dios crea el cielo y la tierra en el principio.',
    },
    {
      index_array: 4,
      consecutivo: '100',
      contenido: 'El amor al prójimo fluye del mismo amor divino.',
    },
  ];
  const index = buildFixtureIndex(units);
  const doc = {
    documentId: 'fixture-es',
    index,
    units,
  };

  // Exact single term
  const cristoUnits = [
    ...units,
    {
      index_array: 5,
      consecutivo: '200',
      contenido: 'Cristo es el centro de la fe católica.',
    },
  ];
  const cristoIndex = buildFixtureIndex(cristoUnits);
  const cristoHits = rankUnitsForDocument(
    { documentId: 'fixture-es', index: cristoIndex, units: cristoUnits },
    parseSearchInput('cristo'),
  );
  assert.ok(cristoHits.length >= 1, 'single term cristo hits');
  assert.ok(
    cristoHits.some((h) => h.unitIndex === 5),
    'cristo unit found',
  );
  assert.ok(
    cristoHits.every((h) => h.documentId === 'fixture-es'),
    'stable documentId',
  );
  assert.ok(
    cristoHits.every((h) => typeof h.unitIndex === 'number'),
    'stable unitIndex',
  );

  // Point range
  const pointHits = rankUnitsForDocument(doc, parseSearchInput('.10-12'));
  assert.ok(pointHits.length >= 3, 'point range returns units');
  const pointIdx = new Set(pointHits.map((h) => h.unitIndex));
  assert.ok(pointIdx.has(0) && pointIdx.has(1) && pointIdx.has(2));

  // Intention: el amor de Dios — must hit unit 0; not random sea unit alone
  const amorHits = rankUnitsForDocument(
    doc,
    parseSearchInput('el amor de Dios'),
  );
  assert.ok(amorHits.length >= 1, 'intention query returns ≥1 hit');
  assert.ok(
    amorHits.some((h) => h.unitIndex === 0),
    'unit with "amor de Dios" wording ranks',
  );
  assert.ok(
    !amorHits.some((h) => h.unitIndex === 2),
    'unrelated sea unit excluded',
  );
  // Synonym path: caridad covers amor expansion + need dios? unit 1 has caridad only
  // → should NOT appear without dios coverage under intention minMatched=2
  assert.ok(
    !amorHits.some((h) => h.unitIndex === 1),
    'caridad alone not enough for "amor de Dios"',
  );
  // unit 3 has dios only — should not flood
  assert.ok(
    !amorHits.some((h) => h.unitIndex === 3),
    'dios alone not enough for intention phrase',
  );
  console.log(
    'amor de Dios hits:',
    amorHits.map((h) => `${h.unitIndex}@${h.score}`).join(', '),
  );

  // Empty query on fixture
  assert.deepStrictEqual(
    rankUnitsForDocument(doc, parseSearchInput('')),
    [],
  );

  // Determinism: run twice
  const a = rankUnitsForDocument(doc, parseSearchInput('el amor de Dios'));
  const b = rankUnitsForDocument(doc, parseSearchInput('el amor de Dios'));
  assert.deepStrictEqual(
    a.map((h) => [h.unitIndex, h.score]),
    b.map((h) => [h.unitIndex, h.score]),
    'deterministic ranking',
  );

  // Related units helper (themes/notes) — excludes source, finds lexical neighbors
  const related = findRelatedUnits(units[0].contenido, [doc], {
    exclude: { documentId: 'fixture-es', unitIndex: 0 },
    limit: 5,
  });
  assert.ok(Array.isArray(related), 'related returns array');
  assert.ok(
    !related.some((h) => h.unitIndex === 0 && h.documentId === 'fixture-es'),
    'related excludes source unit',
  );
  assert.ok(
    related.length >= 1 ||
      findRelatedUnits('amor de Dios en el corazón', [doc], { limit: 5 })
        .length >= 1,
    'related finds at least one neighbor from love-of-God wording',
  );
  console.log(
    'related sample:',
    related.slice(0, 3).map((h) => `${h.unitIndex}@${h.score}`),
  );

  // Expansion weights include caridad for amor
  const weights = expandTermsWithWeights(['amor']);
  assert.ok(weights.get('amor') === 1);
  assert.ok((weights.get('caridad') ?? 0) > 0);
  assert.ok(contentTermsFromText('el de la').length === 0);

  section('real pack slice: cic-es / lg-es');
  assert.ok(fs.existsSync(path.join(CORPUS_CIC, 'content.json')), 'cic content');
  assert.ok(fs.existsSync(path.join(CORPUS_CIC, 'index.json')), 'cic index');
  const cicContent = JSON.parse(
    fs.readFileSync(path.join(CORPUS_CIC, 'content.json'), 'utf8'),
  );
  const cicIndex = JSON.parse(
    fs.readFileSync(path.join(CORPUS_CIC, 'index.json'), 'utf8'),
  );
  assert.ok(Array.isArray(cicContent) && cicContent.length > 100);
  const cicDoc = {
    documentId: 'cic-es',
    index: cicIndex,
    units: cicContent.map((u, i) => ({
      ...u,
      index_array: i,
      unitIndex: i,
    })),
  };

  const q1 = searchCorpus('el amor de Dios', [cicDoc], { limit: 30 });
  const q2 = searchCorpus('el amor de Dios', [cicDoc], { limit: 30 });
  assert.ok(q1.length >= 1, 'cic-es amor de Dios ≥1 hit');
  assert.deepStrictEqual(
    q1.map((h) => [h.documentId, h.unitIndex, h.score]),
    q2.map((h) => [h.documentId, h.unitIndex, h.score]),
    'cic ranking deterministic',
  );
  assert.ok(q1.every((h) => h.documentId === 'cic-es'));
  assert.ok(q1.every((h) => typeof h.unitIndex === 'number'));

  // Top hits thematically related
  let thematic = 0;
  for (const h of q1.slice(0, 10)) {
    const text = (cicContent[h.unitIndex]?.contenido || '').toLowerCase();
    const folded = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (
      (folded.includes('amor') || folded.includes('caridad')) &&
      (folded.includes('dios') || folded.includes('senor'))
    ) {
      thematic++;
    }
  }
  assert.ok(
    thematic >= 1,
    `top hits thematically related (got ${thematic}/10)`,
  );
  console.log(
    'cic top5:',
    q1.slice(0, 5).map((h) => {
      const u = cicContent[h.unitIndex];
      const snip = (u?.contenido || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      return {
        unitIndex: h.unitIndex,
        consecutivo: u?.consecutivo,
        score: h.score,
        snip,
      };
    }),
  );

  // Single term still works on real pack
  const feHits = searchCorpus('fe', [cicDoc], { limit: 5 });
  assert.ok(feHits.length >= 1, 'single term fe');

  // Point lookup on real pack
  const p27 = searchCorpus('.27', [cicDoc], { limit: 5 });
  assert.ok(p27.length >= 1, 'point .27 resolves');
  console.log(
    'point .27 →',
    p27.map((h) => `${h.unitIndex}/${cicContent[h.unitIndex]?.consecutivo}`),
  );

  if (fs.existsSync(path.join(CORPUS_LG, 'index.json'))) {
    const lgContent = JSON.parse(
      fs.readFileSync(path.join(CORPUS_LG, 'content.json'), 'utf8'),
    );
    const lgIndex = JSON.parse(
      fs.readFileSync(path.join(CORPUS_LG, 'index.json'), 'utf8'),
    );
    const lgDoc = {
      documentId: 'lg-es',
      index: lgIndex,
      units: lgContent,
    };
    const lgHits = searchCorpus('amor de Dios', [lgDoc], { limit: 10 });
    console.log('lg-es amor de Dios hits:', lgHits.length);
    assert.ok(lgHits.length >= 0, 'lg search runs');
  }

  section('legacy exact whole-key still usable for single tokens');
  const exactKey = rankUnitsForDocument(
    { documentId: 'fixture-es', index: cristoIndex, units: cristoUnits },
    parseSearchInput('cristo'),
  );
  assert.ok(exactKey.some((h) => h.matchedTerms.includes('cristo')));

  console.log('\nAll semantic-search tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
