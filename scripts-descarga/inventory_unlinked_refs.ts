/**
 * Inventory unlinked inter-document references across the reading corpus.
 *
 * Scans every `content.json` for `referencias[]` without `local`, clusters by
 * normalized description, classifies each cluster (semantic family + status),
 * and writes a regenerable worksheet under documentos/corpus/.
 *
 * Usage:
 *   npm run inventory:unlinked-refs
 *   npx ts-node --transpile-only inventory_unlinked_refs.ts
 *   npx ts-node --transpile-only inventory_unlinked_refs.ts --stdout-summary
 *
 * Source of truth: documentos/corpus (not assets mirror).
 * Does not download from vatican.va — only flags candidates.
 */
import fs from "fs";
import path from "path";
import bookCodes from "./models/data/book-codes.json";
import docCodesFile from "./models/data/doc-codes.json";
import {
  BookCodeEntry,
  DocCodeEntry,
  buildBookIndex,
} from "./src/refs/ref-parser";
import {
  CatalogHint,
  ClassificationResult,
  ClassifierContext,
  UnlinkedRefClass,
  UnlinkedRefStatus,
  buildClassifierContext,
  classifyUnlinkedRef,
  normalizeClusterKey,
  tallyClassifications,
} from "./src/refs/unlinked_ref_classifier";

const REPO = path.resolve(__dirname, "..");
const CORPUS_ROOT = path.join(REPO, "documentos", "corpus");
const DOCUMENTS_DIR = path.join(CORPUS_ROOT, "documents");
const MANIFEST_PATH = path.join(CORPUS_ROOT, "manifest.json");
const WORKSHEET_PATH = path.join(CORPUS_ROOT, "unlinked-refs-worksheet.json");
const CATALOG_PATH = path.join(
  REPO,
  "documentos",
  "registry",
  "source-catalog.json",
);

const WORKSHEET_SCHEMA_VERSION = 1;
const MAX_SOURCES_PER_CLUSTER = 12;

interface DocumentMeta {
  id: string;
  title: string;
  shortTitle?: string;
  kind: string;
  bodyPath: string;
}

interface CorpusManifest {
  version: string | number;
  documents: DocumentMeta[];
}

interface TransportUnit {
  consecutivo?: string;
  contenido?: string;
  referencias?: Array<{
    descripcion?: string;
    local?: { idDocumento: string; idPunto: string };
  }>;
  index_array?: number;
}

interface SourceHit {
  documentId: string;
  unitIndex: number;
  consecutivo: string | null;
}

interface WorksheetEntry {
  clusterKey: string;
  raw: string;
  frequency: number;
  class: UnlinkedRefClass;
  status: UnlinkedRefStatus;
  proposedTarget: ClassificationResult["proposedTarget"];
  notes?: string;
  parserKind?: string;
  sources: SourceHit[];
}

interface WorksheetFile {
  schemaVersion: number;
  generatedAt: string;
  description: string;
  source: string;
  counts: {
    unlinkedRefOccurrences: number;
    clusters: number;
    byStatus: Record<string, number>;
    byClass: Record<string, number>;
    bySourceDocument: Record<string, number>;
  };
  statusEnum: UnlinkedRefStatus[];
  classEnum: UnlinkedRefClass[];
  entries: WorksheetEntry[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadCatalogHints(): CatalogHint[] {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  try {
    const cat = readJson<{
      families?: Array<{
        id: string;
        title: string;
        docCode?: string;
        hubUrl?: string;
        locales?: Array<{
          locale: string;
          corpusDocId?: string;
          url?: string;
        }>;
      }>;
    }>(CATALOG_PATH);
    const hints: CatalogHint[] = [];
    for (const f of cat.families ?? []) {
      const es = f.locales?.find((l) => l.locale === "es");
      hints.push({
        id: f.id,
        title: f.title,
        docCode: f.docCode ?? null,
        corpusDocId: es?.corpusDocId ?? null,
        hubUrl: f.hubUrl ?? es?.url ?? null,
      });
    }
    return hints;
  } catch {
    return [];
  }
}

function loadUnits(contentPath: string): TransportUnit[] {
  const raw = readJson<unknown>(contentPath);
  if (Array.isArray(raw)) return raw as TransportUnit[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.units)) return o.units as TransportUnit[];
    if (Array.isArray(o.articulos)) return o.articulos as TransportUnit[];
    if (Array.isArray(o.content)) return o.content as TransportUnit[];
  }
  return [];
}

interface RawOccurrence {
  documentId: string;
  unitIndex: number;
  consecutivo: string | null;
  descripcion: string;
}

function scanUnlinkedRefs(manifest: CorpusManifest): RawOccurrence[] {
  const out: RawOccurrence[] = [];
  for (const meta of manifest.documents) {
    const contentPath = path.join(CORPUS_ROOT, meta.bodyPath);
    if (!fs.existsSync(contentPath)) {
      // Fallback: documents/<id>/content.json
      const alt = path.join(DOCUMENTS_DIR, meta.id, "content.json");
      if (!fs.existsSync(alt)) continue;
      scanDoc(meta.id, alt, out);
      continue;
    }
    scanDoc(meta.id, contentPath, out);
  }
  return out;
}

function scanDoc(
  documentId: string,
  contentPath: string,
  out: RawOccurrence[],
): void {
  const units = loadUnits(contentPath);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const refs = u.referencias ?? [];
    for (const r of refs) {
      if (r.local) continue;
      const descripcion = (r.descripcion ?? "").trim();
      if (!descripcion) continue;
      out.push({
        documentId,
        unitIndex: typeof u.index_array === "number" ? u.index_array : i,
        consecutivo: u.consecutivo ?? null,
        descripcion,
      });
    }
  }
}

interface ClusterAcc {
  raw: string;
  frequency: number;
  sources: SourceHit[];
}

function clusterOccurrences(rows: RawOccurrence[]): Map<string, ClusterAcc> {
  const m = new Map<string, ClusterAcc>();
  for (const r of rows) {
    const key = normalizeClusterKey(r.descripcion);
    if (!key) continue;
    let acc = m.get(key);
    if (!acc) {
      acc = { raw: r.descripcion, frequency: 0, sources: [] };
      m.set(key, acc);
    }
    acc.frequency += 1;
    // Keep a stable display raw (prefer longer original if same key)
    if (r.descripcion.length > acc.raw.length) acc.raw = r.descripcion;
    if (acc.sources.length < MAX_SOURCES_PER_CLUSTER) {
      acc.sources.push({
        documentId: r.documentId,
        unitIndex: r.unitIndex,
        consecutivo: r.consecutivo,
      });
    }
  }
  return m;
}

function classifyClusters(
  clusters: Map<string, ClusterAcc>,
  ctx: ClassifierContext,
): WorksheetEntry[] {
  const entries: WorksheetEntry[] = [];
  for (const [clusterKey, acc] of clusters) {
    const c = classifyUnlinkedRef(acc.raw, ctx);
    entries.push({
      clusterKey,
      raw: acc.raw,
      frequency: acc.frequency,
      class: c.class,
      status: c.status,
      proposedTarget: c.proposedTarget,
      notes: c.notes,
      parserKind: c.parserKind,
      sources: acc.sources,
    });
  }
  // Stable order: highest frequency first, then raw
  entries.sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.raw.localeCompare(b.raw, "es");
  });
  return entries;
}

function countBySourceDoc(rows: RawOccurrence[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) {
    m[r.documentId] = (m[r.documentId] ?? 0) + 1;
  }
  return m;
}

/** Weighted tallies (sum of frequencies). */
function weightedTallies(entries: WorksheetEntry[]): {
  byStatus: Record<string, number>;
  byClass: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  const byClass: Record<string, number> = {};
  for (const e of entries) {
    byStatus[e.status] = (byStatus[e.status] ?? 0) + e.frequency;
    byClass[e.class] = (byClass[e.class] ?? 0) + e.frequency;
  }
  return { byStatus, byClass };
}

function printSummary(ws: WorksheetFile): void {
  console.log("=== unlinked-refs worksheet ===");
  console.log(`generatedAt: ${ws.generatedAt}`);
  console.log(`path: ${WORKSHEET_PATH}`);
  console.log(
    `occurrences: ${ws.counts.unlinkedRefOccurrences}  clusters: ${ws.counts.clusters}`,
  );
  console.log("byStatus (weighted by frequency):");
  for (const [k, v] of Object.entries(ws.counts.byStatus).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("byClass (weighted by frequency):");
  for (const [k, v] of Object.entries(ws.counts.byClass).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${k}: ${v}`);
  }
  const topDocs = Object.entries(ws.counts.bySourceDocument)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  console.log("top source documents:");
  for (const [id, n] of topDocs) console.log(`  ${id}: ${n}`);

  // Spot-check samples
  const samples: Array<[string, (e: WorksheetEntry) => boolean]> = [
    ["noise year", (e) => e.class === "year-noise"],
    ["CDF / curial", (e) => e.class === "curial"],
    ["DS-style", (e) => e.class === "ds-style"],
    ["patristic", (e) => e.class === "patristic"],
    ["DV/magisterial", (e) => e.class === "magisterial-code"],
    ["bible unresolved", (e) => e.class === "bible-unresolved"],
  ];
  console.log("spot-check samples:");
  for (const [label, pred] of samples) {
    const hit = ws.entries.find(pred);
    if (hit) {
      console.log(
        `  [${label}] status=${hit.status} class=${hit.class} freq=${hit.frequency} raw=${JSON.stringify(hit.raw).slice(0, 100)}`,
      );
    } else {
      console.log(`  [${label}] (none)`);
    }
  }

  // Cross-count: sum frequencies should equal unlinked occurrences
  const sumFreq = ws.entries.reduce((s, e) => s + e.frequency, 0);
  console.log(
    `cross-count: sum(frequencies)=${sumFreq} unlinkedRefOccurrences=${ws.counts.unlinkedRefOccurrences} match=${sumFreq === ws.counts.unlinkedRefOccurrences}`,
  );
}

function main(): void {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Missing manifest: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = readJson<CorpusManifest>(MANIFEST_PATH);
  const docCodes = (docCodesFile as { documents: DocCodeEntry[] }).documents;
  const bookIndex = buildBookIndex(bookCodes as BookCodeEntry[]);
  const catalogHints = loadCatalogHints();

  const corpusDocIds = new Set(manifest.documents.map((d) => d.id));
  const ctx = buildClassifierContext({
    corpusDocIds,
    docCodes,
    bookIndex,
    catalogHints,
  });

  const occurrences = scanUnlinkedRefs(manifest);
  const clusters = clusterOccurrences(occurrences);
  const entries = classifyClusters(clusters, ctx);
  const weighted = weightedTallies(entries);

  // Cluster-level tallies for diagnostics (unit tests may use pure tally)
  void tallyClassifications(
    entries.map((e) => ({
      raw: e.raw,
      class: e.class,
      status: e.status,
      proposedTarget: e.proposedTarget,
      notes: e.notes,
      parserKind: e.parserKind,
    })),
  );

  const worksheet: WorksheetFile = {
    schemaVersion: WORKSHEET_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    description:
      "Worksheet of unlinked inter-document references: citations without ref.local after basic resolve:refs (book-codes + doc-codes). Clusters by normalized description with semantic class and corpus vs vatican.va download status.",
    source: "documentos/corpus (manifest + documents/**/content.json)",
    counts: {
      unlinkedRefOccurrences: occurrences.length,
      clusters: entries.length,
      byStatus: weighted.byStatus,
      byClass: weighted.byClass,
      bySourceDocument: countBySourceDoc(occurrences),
    },
    statusEnum: [
      "in-corpus",
      "known-code-missing-locator",
      "not-in-corpus",
      "noise/non-document",
      "needs-vatican.va-download",
    ],
    classEnum: [
      "structural-noise",
      "year-noise",
      "date-noise",
      "fragment-noise",
      "prose-noise",
      "bible-unresolved",
      "ds-style",
      "magisterial-code",
      "magisterial-free-title",
      "patristic",
      "conciliar",
      "curial",
      "liturgical",
      "canon-law",
      "roman-catechism",
      "scholastic",
      "unresolved-abbr",
      "unknown",
    ],
    entries,
  };

  writeJson(WORKSHEET_PATH, worksheet);
  printSummary(worksheet);

  // Sanity gates
  if (worksheet.counts.unlinkedRefOccurrences === 0) {
    console.error("FAIL: no unlinked refs found (expected non-empty set)");
    process.exit(2);
  }
  if (!worksheet.entries.length) {
    console.error("FAIL: worksheet entries empty");
    process.exit(2);
  }
  for (const e of worksheet.entries) {
    if (!e.raw || !e.status || !e.class || !e.sources?.length) {
      console.error("FAIL: entry missing required fields", e.clusterKey);
      process.exit(2);
    }
    // proposedTarget required unless noise/unknown-without-title
    if (
      e.status !== "noise/non-document" &&
      e.proposedTarget == null &&
      e.class !== "unresolved-abbr" &&
      e.class !== "unknown" &&
      e.class !== "fragment-noise"
    ) {
      // allow null proposed for some classes; still valid JSON
    }
  }

  const noise = weighted.byStatus["noise/non-document"] ?? 0;
  const download = weighted.byStatus["needs-vatican.va-download"] ?? 0;
  const inCorpus = weighted.byStatus["in-corpus"] ?? 0;
  if (noise === 0 && download === 0 && inCorpus === 0) {
    console.error(
      "FAIL: expected status tallies to distinguish noise vs download vs in-corpus",
    );
    process.exit(2);
  }

  console.log("OK: worksheet written");
  if (hasFlag("--stdout-summary")) {
    // already printed
  }
}

main();
