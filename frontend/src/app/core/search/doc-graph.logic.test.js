/**
 * Document citation map helpers.
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/search/doc-graph.logic.test.js
 */
const assert = require('assert');
const G = require('./doc-graph.logic.ts');

const graph = {
  version: 1,
  locale: 'es',
  nodes: [
    {
      id: 'cic-es',
      title: 'Catecismo',
      shortTitle: 'CIC',
      kind: 'catechism',
      inDegree: 1,
      outDegree: 2,
      x: 0.4,
      y: 0.4,
    },
    {
      id: 'lg-es',
      title: 'Lumen gentium',
      shortTitle: 'LG',
      kind: 'magisterium',
      inDegree: 2,
      outDegree: 1,
      x: 0.7,
      y: 0.3,
    },
    {
      id: 'bible-pueblo-de-dios-es',
      title: 'Biblia',
      shortTitle: 'Biblia',
      kind: 'bible',
      inDegree: 3,
      outDegree: 0,
      x: 0.5,
      y: 0.2,
    },
  ],
  edges: {
    'cic-es': [
      {
        documentId: 'lg-es',
        count: 2,
        w: 0.5,
        samples: [{ fromUnit: 10, toUnit: 2 }],
      },
      {
        documentId: 'bible-pueblo-de-dios-es',
        count: 5,
        w: 0.8,
        samples: [{ fromUnit: 1, toUnit: 9 }],
      },
    ],
    'lg-es': [
      {
        documentId: 'bible-pueblo-de-dios-es',
        count: 1,
        w: 0.3,
        samples: [{ fromUnit: 2, toUnit: 9 }],
      },
    ],
  },
};

assert.strictEqual(G.kindLabel('bible'), 'Escritura');
assert.strictEqual(G.neighborsForDoc(graph, 'cic-es').length, 2);
assert.ok(G.nodeById(graph, 'lg-es'));
const vis = G.visibleSubgraph(graph, { focusId: 'cic-es' });
assert.ok(vis.nodes.some((n) => n.id === 'cic-es'));
assert.ok(vis.links.some((l) => l.from === 'cic-es' && l.to === 'lg-es'));
const edge = G.edgeSamples(graph, 'cic-es', 'lg-es');
assert.ok(edge && edge.count === 2);
console.log('doc-graph.logic.test.js: ok');
