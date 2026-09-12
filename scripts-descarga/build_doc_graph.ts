/**
 * Build compact document-level citation graph from unit-graph.json.
 * Dual-writes search/{locale}/doc-graph.json and updates locale manifest files.docGraph.
 *
 * Usage:
 *   npx ts-node --transpile-only build_doc_graph.ts --locale es
 */

import * as fs from "fs";
import * as path from "path";
import { aggregateDocGraph, type DocMetaLite } from "./src/topics/doc_graph";

const REPO = path.resolve(__dirname, "..");
const CORPUS_ROOTS = [
  path.join(REPO, "documentos", "corpus"),
  path.join(REPO, "frontend", "src", "assets", "corpus"),
];

function parseArgs(argv: string[]) {
  let locale = "es";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--locale" && argv[i + 1]) locale = argv[++i];
  }
  return { locale };
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data) + "\n", "utf8");
}

function main() {
  const { locale } = parseArgs(process.argv.slice(2));
  const primary = CORPUS_ROOTS[0];
  const graphPath = path.join(primary, "search", locale, "unit-graph.json");
  if (!fs.existsSync(graphPath)) {
    console.error(`missing ${graphPath} — run topics:build-graph first`);
    process.exit(1);
  }
  const unitGraph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
  const man = JSON.parse(
    fs.readFileSync(path.join(primary, "manifest.json"), "utf8"),
  );
  const metas: DocMetaLite[] = (man.documents || []).filter((d: DocMetaLite) => {
    const loc = (d.locale || "").toLowerCase();
    return loc === locale || String(d.id).toLowerCase().endsWith(`-${locale}`);
  });

  const docGraph = aggregateDocGraph(unitGraph, metas, { locale });
  const edgePairs = Object.values(docGraph.edges).reduce(
    (n, list) => n + list.length,
    0,
  );

  for (const root of CORPUS_ROOTS) {
    const locDir = path.join(root, "search", locale);
    fs.mkdirSync(locDir, { recursive: true });
    writeJson(path.join(locDir, "doc-graph.json"), docGraph);

    const locManPath = path.join(locDir, "manifest.json");
    let locMan: Record<string, unknown> = {
      version: "0.3.0",
      schema: 1,
      locale,
      files: {},
    };
    if (fs.existsSync(locManPath)) {
      try {
        locMan = JSON.parse(fs.readFileSync(locManPath, "utf8"));
      } catch {
        /* default */
      }
    }
    const files = {
      ...((locMan.files as Record<string, string>) || {}),
      graph: "unit-graph.json",
      docGraph: "doc-graph.json",
    };
    locMan.files = files;
    locMan.docGraphNodeCount = docGraph.nodes.length;
    locMan.docGraphEdgeCount = edgePairs;
    writeJson(locManPath, locMan);
  }

  console.log(
    JSON.stringify(
      {
        locale,
        nodes: docGraph.nodes.length,
        edgePairs,
      },
      null,
      2,
    ),
  );
}

main();
