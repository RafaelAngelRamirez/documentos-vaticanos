/**
 * Product UX helpers for related citations + structural wiring checks.
 * Run from frontend/:
 *   node --experimental-strip-types src/app/core/search/related-suggestion.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'semantic-search.logic.ts');
const SEMANTIC = path.join(HERE, 'semantic-search.logic.ts');
const BUSCAR_HTML = path.resolve(
  HERE,
  '../../pages/buscar/buscar.component.html',
);
const BUSCADOR_TS = path.resolve(
  HERE,
  '../../components/buscador/buscador.component.ts',
);
const TEMA_HTML = path.resolve(
  HERE,
  '../../pages/tema-detalle/tema-detalle.component.html',
);
const TEMA_TS = path.resolve(
  HERE,
  '../../pages/tema-detalle/tema-detalle.component.ts',
);
const PANEL_TS = path.resolve(
  HERE,
  '../../components/related-units/related-units-panel.component.ts',
);
const PANEL_HTML = path.resolve(
  HERE,
  '../../components/related-units/related-units-panel.component.html',
);
const CORPUS_CIC = path.resolve(
  HERE,
  '../../../assets/corpus/documents/cic-es',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

function buildFixtureDocs() {
  const {
    stripDiacritics,
    cleanForIndex,
  } = require('./semantic-search.logic.ts');
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
      contenido:
        'La caridad hacia Dios y el prójimo resume la ley y los profetas.',
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
      contenido:
        'El amor al prójimo fluye del mismo amor de Dios que habita en nosotros.',
    },
  ];
  const indice = {};
  const indice_por_punto = {};
  units.forEach((u, i) => {
    const n = parseInt(u.consecutivo, 10);
    if (!Number.isNaN(n)) indice_por_punto[i] = n;
    let text = cleanForIndex(stripDiacritics(u.contenido)).toLowerCase();
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (!indice[word]) indice[word] = [];
      if (!indice[word].includes(i)) indice[word].push(i);
    }
  });
  return {
    units,
    docs: [
      {
        documentId: 'fixture-es',
        index: { indice, indice_por_punto },
        units,
      },
    ],
  };
}

async function main() {
  section('artifacts + wiring');
  assert.ok(fs.existsSync(LOGIC), 'semantic-search.logic.ts (product helpers)');
  assert.ok(fs.existsSync(SEMANTIC), 'semantic-search.logic.ts');
  assert.ok(fs.existsSync(PANEL_TS), 'related-units-panel.component.ts');
  assert.ok(fs.existsSync(PANEL_HTML), 'related-units-panel.component.html');

  const buscarHtml = fs.readFileSync(BUSCAR_HTML, 'utf8');
  const buscadorTs = fs.readFileSync(BUSCADOR_TS, 'utf8');
  const temaHtml = fs.readFileSync(TEMA_HTML, 'utf8');
  const temaTs = fs.readFileSync(TEMA_TS, 'utf8');
  const panelTs = fs.readFileSync(PANEL_TS, 'utf8');
  const panelHtml = fs.readFileSync(PANEL_HTML, 'utf8');

  assert.ok(
    /frase|intenci[oó]n/i.test(buscarHtml),
    '/buscar placeholder or hint mentions phrase/intention',
  );
  assert.ok(
    buscarHtml.includes('formControl') || buscarHtml.includes('formcontrol'),
    '/buscar has search control',
  );
  assert.ok(
    buscarHtml.includes('app-buscador'),
    '/buscar hosts result list component',
  );
  assert.ok(
    buscadorTs.includes('rankUnitsForDocument'),
    'buscador uses ranked hits',
  );

  assert.ok(
    panelTs.includes('findRelatedUnits') ||
      panelTs.includes('suggestRelated') ||
      panelTs.includes('semantic-search.logic'),
    'panel uses related suggestion entry',
  );
  assert.ok(
    panelHtml.includes('documentId') ||
      panelHtml.includes('row.title') ||
      panelHtml.includes('open(row)'),
    'panel template binds citation rows',
  );
  assert.ok(
    panelHtml.includes('srow') || panelHtml.includes('class="st"'),
    'panel uses handoff-like list classes',
  );

  assert.ok(
    temaHtml.includes('app-related-units-panel'),
    'tema-detalle wires related panel',
  );
  assert.ok(
    temaHtml.includes('addCitation') || temaTs.includes('addRelatedCitation'),
    'tema can add related citation',
  );
  assert.ok(
    temaTs.includes('semantic-search.logic') ||
      temaTs.includes('RelatedUnitsPanelComponent'),
    'tema imports related panel / logic',
  );
  assert.ok(
    temaTs.includes('documentId') && temaTs.includes('unitIndex'),
    'tema steps use stable citations',
  );
  console.log('wiring: buscar + panel + tema-detalle OK');

  const semantic = require('./semantic-search.logic.ts');
  const {
    seedTextFromStep,
    pickSeedStep,
    suggestRelatedCitations,
    suggestRelatedForStep,
    mapHitsToRelatedRows,
    toSearchDocumentInput,
    searchCorpus,
    parseSearchInput,
    findRelatedUnits,
  } = semantic;

  section('empty / single / point still work (shipped search entry)');
  assert.deepStrictEqual(searchCorpus('', []), []);
  assert.strictEqual(parseSearchInput('').empty, true);

  const { docs, units } = buildFixtureDocs();
  const cristoUnits = [
    ...units,
    {
      index_array: 5,
      consecutivo: '200',
      contenido: 'Cristo es el centro de la fe católica.',
    },
  ];
  // rebuild index for cristo
  const {
    stripDiacritics,
    cleanForIndex,
  } = require('./semantic-search.logic.ts');
  const indice = {};
  const indice_por_punto = {};
  cristoUnits.forEach((u, i) => {
    const n = parseInt(u.consecutivo, 10);
    if (!Number.isNaN(n)) indice_por_punto[i] = n;
    let text = cleanForIndex(stripDiacritics(u.contenido)).toLowerCase();
    for (const word of text.split(/\s+/).filter(Boolean)) {
      if (!indice[word]) indice[word] = [];
      if (!indice[word].includes(i)) indice[word].push(i);
    }
  });
  const docC = {
    documentId: 'fixture-es',
    index: { indice, indice_por_punto },
    units: cristoUnits,
  };

  const single = searchCorpus('cristo', [docC]);
  assert.ok(single.length >= 1, 'single-term still hits');
  assert.ok(single.every((h) => h.documentId && typeof h.unitIndex === 'number'));

  const points = searchCorpus('.10-11', [docC]);
  assert.ok(points.length >= 2, 'point range still works');

  const intention = searchCorpus('el amor de Dios', [docs[0]]);
  assert.ok(intention.length >= 1, 'intention phrase ≥1 hit');
  assert.ok(
    intention.every(
      (h) => h.documentId === 'fixture-es' && typeof h.unitIndex === 'number',
    ),
  );
  console.log(
    'intention hits',
    intention.map((h) => h.unitIndex),
  );

  section('related-from-source (shipped suggestRelated*)');
  const seed = seedTextFromStep(
    {
      documentId: 'fixture-es',
      unitIndex: 0,
      unitLabel: '10',
      userComment: 'amor de Dios',
    },
    units[0].contenido,
  );
  assert.ok(seed.includes('amor') || seed.length > 10);

  const step = pickSeedStep([
    { documentId: 'fixture-es', unitIndex: 0, unitLabel: '10' },
    { documentId: 'fixture-es', unitIndex: 4, unitLabel: '100' },
  ]);
  assert.strictEqual(step.unitIndex, 4);

  const relatedRows = suggestRelatedForStep(
    {
      documentId: 'fixture-es',
      unitIndex: 0,
      unitLabel: '10',
      userComment: null,
    },
    docs,
    { limit: 5 },
  );
  assert.ok(relatedRows.length >= 1, 'related ≥1 neighbor from unit 0');
  assert.ok(
    !relatedRows.some(
      (r) => r.documentId === 'fixture-es' && r.unitIndex === 0,
    ),
    'excludes source unit',
  );
  assert.ok(
    relatedRows.every(
      (r) =>
        typeof r.documentId === 'string' &&
        typeof r.unitIndex === 'number' &&
        r.title &&
        typeof r.snippet === 'string',
    ),
    'stable citation fields on rows',
  );
  console.log(
    'related fixture:',
    relatedRows.map((r) => `${r.unitIndex}:${r.title}`),
  );

  const a = suggestRelatedCitations(units[0].contenido, docs, {
    exclude: { documentId: 'fixture-es', unitIndex: 0 },
    limit: 5,
  });
  const b = suggestRelatedCitations(units[0].contenido, docs, {
    exclude: { documentId: 'fixture-es', unitIndex: 0 },
    limit: 5,
  });
  assert.deepStrictEqual(
    a.map((r) => [r.documentId, r.unitIndex, r.score]),
    b.map((r) => [r.documentId, r.unitIndex, r.score]),
    'related deterministic',
  );

  // empty seed → empty
  assert.deepStrictEqual(suggestRelatedCitations('', docs), []);
  assert.deepStrictEqual(
    suggestRelatedForStep(
      { documentId: 'fixture-es', unitIndex: 2 },
      // unit 2 is sea — still has text so may return something or not;
      // empty docs must be empty
      [],
    ),
    [],
  );

  section('real pack cic-es related samples');
  assert.ok(fs.existsSync(path.join(CORPUS_CIC, 'content.json')));
  const cicContent = JSON.parse(
    fs.readFileSync(path.join(CORPUS_CIC, 'content.json'), 'utf8'),
  );
  const cicIndex = JSON.parse(
    fs.readFileSync(path.join(CORPUS_CIC, 'index.json'), 'utf8'),
  );
  const cicDoc = toSearchDocumentInput('cic-es', cicIndex, cicContent);

  // Pick a known amor de Dios style unit from search
  const seedHits = searchCorpus('el amor de Dios', [cicDoc], { limit: 5 });
  assert.ok(seedHits.length >= 1, 'cic seed hits');
  const src = seedHits[0];
  const body = cicContent[src.unitIndex]?.contenido || '';
  assert.ok(body.length > 20, 'seed unit has text');

  const r1 = suggestRelatedCitations(body, [cicDoc], {
    exclude: { documentId: 'cic-es', unitIndex: src.unitIndex },
    limit: 10,
  });
  const r2 = suggestRelatedCitations(body, [cicDoc], {
    exclude: { documentId: 'cic-es', unitIndex: src.unitIndex },
    limit: 10,
  });
  assert.ok(r1.length >= 1, 'cic related ≥1');
  assert.deepStrictEqual(
    r1.map((r) => [r.documentId, r.unitIndex, r.score]),
    r2.map((r) => [r.documentId, r.unitIndex, r.score]),
    'cic related deterministic',
  );
  assert.ok(
    !r1.some((r) => r.unitIndex === src.unitIndex && r.documentId === 'cic-es'),
  );

  let thematic = 0;
  for (const row of r1.slice(0, 8)) {
    const t = (cicContent[row.unitIndex]?.contenido || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const seedFold = body
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const seedTerms = seedFold
      .split(/\W+/)
      .filter((w) => w.length > 3)
      .slice(0, 12);
    if (seedTerms.some((w) => t.includes(w))) thematic++;
  }
  assert.ok(thematic >= 1, `thematic overlap in related (got ${thematic})`);

  console.log(
    'cic related top:',
    r1.slice(0, 5).map((r) => ({
      documentId: r.documentId,
      unitIndex: r.unitIndex,
      consecutivo: r.consecutivo,
      title: r.title,
      score: r.score,
      snip: r.snippet.slice(0, 80),
    })),
  );

  // mapHits path
  const rawHits = findRelatedUnits(body, [cicDoc], {
    exclude: { documentId: 'cic-es', unitIndex: src.unitIndex },
    limit: 3,
  });
  const mapped = mapHitsToRelatedRows(rawHits, [cicDoc]);
  assert.strictEqual(mapped.length, rawHits.length);
  assert.ok(mapped[0].title.includes('cic-es'));

  console.log('\nAll product related-suggestion tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
