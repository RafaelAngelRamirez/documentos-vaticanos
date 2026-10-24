/**
 * Document citation graph aggregation + layout.
 * Run: node scripts-descarga/doc_graph.test.js
 */
const assert = require("assert");
const path = require("path");
const { pathToFileURL } = require("url");

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, "src/topics/doc_graph.ts")).href
  );
  const { aggregateDocGraph, neighborsForDoc, layoutDocNodes } = mod;

  const unitGraph = {
    version: 1,
    locale: "es",
    edges: {
      "cic-es:10": [
        { documentId: "bible-pueblo-de-dios-es", unitIndex: 1, type: "ref", weight: 1 },
        { documentId: "lg-es", unitIndex: 2, type: "ref", weight: 1 },
      ],
      "cic-es:11": [
        { documentId: "lg-es", unitIndex: 3, type: "ref", weight: 1 },
      ],
      "lg-es:2": [
        { documentId: "bible-pueblo-de-dios-es", unitIndex: 9, type: "ref", weight: 1 },
        {
          documentId: "cic-es",
          unitIndex: 10,
          type: "ref-reciprocal",
          weight: 0.85,
        },
      ],
    },
  };
  const metas = [
    { id: "cic-es", title: "Catecismo", shortTitle: "CIC", kind: "catechism" },
    { id: "lg-es", title: "Lumen gentium", shortTitle: "LG", kind: "magisterium" },
    {
      id: "bible-pueblo-de-dios-es",
      title: "Biblia",
      shortTitle: "Biblia",
      kind: "bible",
    },
  ];
  const g = aggregateDocGraph(unitGraph, metas, { locale: "es" });
  assert.strictEqual(g.locale, "es");
  assert.ok(g.nodes.length >= 3, "connected nodes");
  const cic = neighborsForDoc(g, "cic-es");
  const toLg = cic.find((e) => e.documentId === "lg-es");
  assert.ok(toLg && toLg.count === 2, "cic → lg weight 2");
  const toBible = cic.find((e) => e.documentId === "bible-pueblo-de-dios-es");
  assert.ok(toBible && toBible.count === 1, "cic → bible");
  assert.ok(
    !cic.some((e) => e.documentId === "cic-es"),
    "no self-loop same-doc",
  );
  const lgOut = neighborsForDoc(g, "lg-es");
  assert.ok(
    lgOut.every((e) => e.documentId !== "cic-es" || e.count >= 1),
    "reciprocal unit edges do not inflate doc-graph as extra ref",
  );

  for (const n of g.nodes) {
    assert.ok(n.x >= 0 && n.x <= 1 && n.y >= 0 && n.y <= 1, "layout 0..1");
  }

  const laid = layoutDocNodes([
    { id: "a", title: "A", shortTitle: "A", kind: "bible", inDegree: 1, outDegree: 0 },
    { id: "b", title: "B", shortTitle: "B", kind: "catechism", inDegree: 0, outDegree: 1 },
  ]);
  assert.strictEqual(laid.length, 2);

  console.log("doc_graph.test.js: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
