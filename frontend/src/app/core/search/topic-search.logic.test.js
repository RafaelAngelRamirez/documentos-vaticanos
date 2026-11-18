/**
 * Pure topic-search helpers (graph merge, boost).
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/search/topic-search.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const T = require('./topic-search.logic.ts');
const GRAPH = path.resolve(
  HERE,
  '../../../assets/corpus/search/es/unit-graph.json',
);
const RELATED_TS = path.resolve(
  HERE,
  '../../components/related-units/related-units-panel.component.ts',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

function main() {
  section('mergeRelatedByEvidence prefers ref over lexical');
  const merged = T.mergeRelatedByEvidence(
    [
      {
        documentId: 'bible-pueblo-de-dios-es',
        unitIndex: 100,
        score: 5,
        title: 'bible · Nº 100',
        snippet: 'ref hit',
        matchedTerms: [],
        reason: 'ref',
      },
    ],
    [
      {
        documentId: 'cic-es',
        unitIndex: 1,
        score: 9,
        title: 'cic · Nº 1',
        snippet: 'lex',
        matchedTerms: ['amor'],
        reason: 'lexical',
      },
      {
        documentId: 'bible-pueblo-de-dios-es',
        unitIndex: 100,
        score: 3,
        title: 'bible · Nº 100',
        snippet: 'also lex',
        matchedTerms: ['dios'],
        reason: 'lexical',
      },
    ],
    8,
  );
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].documentId, 'bible-pueblo-de-dios-es');
  assert.strictEqual(merged[0].reason, 'ref');
  assert.ok(merged[0].score >= 5);
  assert.ok(merged[0].matchedTerms.includes('dios'));
  console.log('  merge OK');

  section('neighborsFromGraph on shipped unit-graph');
  assert.ok(fs.existsSync(GRAPH), 'unit-graph.json must exist after build');
  const graph = JSON.parse(fs.readFileSync(GRAPH, 'utf8'));
  assert.strictEqual(graph.locale, 'es');
  assert.ok(graph.edges && typeof graph.edges === 'object');
  const keys = Object.keys(graph.edges);
  assert.ok(keys.length > 100, `expected many nodes, got ${keys.length}`);
  // Find a cic-es node with edges
  const cicKey = keys.find((k) => k.startsWith('cic-es:'));
  assert.ok(cicKey, 'expected at least one cic-es graph node');
  const [docId, uiStr] = cicKey.split(':');
  const ui = Number(uiStr);
  const neigh = T.neighborsFromGraph(graph, docId, ui);
  assert.ok(neigh.length >= 1, 'cic node should have neighbors');
  assert.ok(neigh[0].documentId);
  assert.ok(Number.isFinite(neigh[0].unitIndex));
  console.log(`  sample ${cicKey} → ${neigh.length} neighbors`);

  section('rowsFromGraphNeighbors');
  const rows = T.rowsFromGraphNeighbors(docId, ui, neigh, [
    {
      documentId: neigh[0].documentId,
      units: {
        // sparse fake: only one unit
      },
    },
  ]);
  // units as array missing — still produces rows with fallback snippet
  const rows2 = T.rowsFromGraphNeighbors(
    docId,
    ui,
    neigh.slice(0, 3),
    [
      {
        documentId: neigh[0].documentId,
        shortTitle: 'Catecismo',
        nombre: 'Catecismo de la Iglesia Católica',
        units: Array.from({ length: neigh[0].unitIndex + 1 }, (_, i) =>
          i === neigh[0].unitIndex
            ? { consecutivo: String(i), contenido: 'Cuerpo de prueba del target' }
            : { consecutivo: String(i), contenido: '' },
        ),
      },
    ],
    { limit: 3 },
  );
  assert.ok(rows2.length >= 1);
  assert.strictEqual(rows2[0].reason, 'ref');
  assert.strictEqual(rows2[0].documentId, neigh[0].documentId);
  assert.ok(rows2[0].title.startsWith('Catecismo · Nº '));
  assert.ok(!rows2[0].title.includes(neigh[0].documentId));
  assert.ok(rows2[0].snippet.includes('Cuerpo') || rows2[0].snippet.length > 0);
  console.log('  graph rows OK');

  section('neighborsInLoadedPool drops packs outside the hub pool');
  const pooled = T.neighborsInLoadedPool(
    [
      { documentId: 'cic-es', unitIndex: 2, weight: 1, type: 'ref' },
      { documentId: 'padre-fuera', unitIndex: 9, weight: 1, type: 'ref' },
    ],
    ['cic-es', 'lg-es'],
  );
  assert.strictEqual(pooled.length, 1);
  assert.strictEqual(pooled[0].documentId, 'cic-es');
  assert.strictEqual(T.neighborsInLoadedPool(pooled, []).length, 0);
  console.log('  pool filter OK');

  section('related panel wiring');
  const src = fs.readFileSync(RELATED_TS, 'utf8');
  assert.ok(src.includes('mergeRelatedByEvidence'));
  assert.ok(src.includes('TopicIndexService'));
  assert.ok(src.includes('loadGraphs'));
  assert.ok(src.includes('neighborsFromGraph'));
  assert.ok(src.includes('neighborsInLoadedPool'));
  assert.ok(src.includes('graphWithinPool'));
  assert.ok(src.includes("this.openStack === 'push' ? 'push' : 'keep'"));
  assert.ok(!/\bensureAllLoaded\b/.test(src));
  assert.ok(!src.includes('history.pushState'));
  const lectorHtml = fs.readFileSync(
    path.resolve(HERE, '../../components/lector/lector.component.html'),
    'utf8',
  );
  assert.ok(lectorHtml.includes('Vocabulario parecido'));
  assert.ok(lectorHtml.includes('openStack="push"'));
  assert.ok(lectorHtml.includes('graphWithinPool'));
  assert.ok(lectorHtml.includes('*ngIf="vocabOpen"'));
  const vocabBlock = lectorHtml.split('class="reader-vocab"')[1] || '';
  assert.ok(vocabBlock.length > 0);
  assert.ok(!vocabBlock.slice(0, 900).includes('dv-sheet'));
  console.log('  panel wiring OK');

  console.log('\nAll topic-search tests passed.');
}

main();
