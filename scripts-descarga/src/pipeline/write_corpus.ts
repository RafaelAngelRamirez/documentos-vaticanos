/**
 * Write a scraped document into the versioned corpus layout and merge manifest.
 * Also updates doc-codes.json corpusDocId when source.docCode is set.
 */
import fs from "fs";
import path from "path";
import type { TrasnportData } from "../../models/transport_data.model";
import type {
  CorpusIndex,
  CorpusManifest,
  DocumentMeta,
} from "../../models/corpus.model";
import type { SourceConfig } from "../adapters/types";
import { buildIndex } from "./build_index";

const REPO = path.resolve(__dirname, "../../..");
const SCRIPTS = path.resolve(__dirname, "../..");

export const CORPUS_ROOTS = [
  path.join(REPO, "documentos", "corpus"),
  path.join(REPO, "frontend", "src", "assets", "corpus"),
];

const DOC_CODES_PATH = path.join(
  SCRIPTS,
  "models",
  "data",
  "doc-codes.json",
);

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown, pretty = false): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(
    filePath,
    pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data),
    "utf-8",
  );
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export interface WriteCorpusResult {
  meta: DocumentMeta;
  index: CorpusIndex;
  unitCount: number;
  termCount: number;
  roots: string[];
}

/**
 * Persist content + index + meta for one source into every corpus root,
 * merging into existing manifest.json (does not drop bible/cic).
 */
export function writeCorpusDocument(
  config: SourceConfig,
  units: TrasnportData[],
  options?: { corpusVersion?: string },
): WriteCorpusResult {
  const index = buildIndex(units);
  const unitCount = units.length;
  const termCount = Object.keys(index.indice).length;

  const relBody = `documents/${config.corpusDocId}/content.json`;
  const relIndex = `documents/${config.corpusDocId}/index.json`;
  const relMeta = `documents/${config.corpusDocId}/meta.json`;

  const meta: DocumentMeta = {
    id: config.corpusDocId,
    title: config.title,
    shortTitle: config.shortTitle,
    kind: config.kind,
    locale: config.locale,
    bodyPath: relBody,
    indexPath: relIndex,
    unitCount,
  };

  for (const root of CORPUS_ROOTS) {
    ensureDir(path.join(root, "documents", config.corpusDocId));
    writeJson(path.join(root, relBody), units);
    writeJson(path.join(root, relIndex), index);
    writeJson(path.join(root, relMeta), meta);

    const manifestPath = path.join(root, "manifest.json");
    let manifest: CorpusManifest = {
      version: options?.corpusVersion ?? "1.0.0",
      generatedAt: new Date().toISOString(),
      documents: [],
    };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = readJson<CorpusManifest>(manifestPath);
      } catch {
        /* fresh */
      }
    }
    const others = (manifest.documents ?? []).filter(
      (d) => d.id !== config.corpusDocId,
    );
    manifest.documents = [...others, meta];
    manifest.generatedAt = new Date().toISOString();
    if (!manifest.version) manifest.version = options?.corpusVersion ?? "1.0.0";
    writeJson(manifestPath, manifest);
    console.log(`[✓] corpus → ${path.join(root, "documents", config.corpusDocId)}`);
    console.log(`[✓] manifest → ${manifestPath}`);
  }

  // Working copy under scripts-descarga/documentos/
  const workBase = path.join(SCRIPTS, "documentos", config.corpusDocId);
  writeJson(`${workBase}.json`, units);
  writeJson(`${workBase}.index.json`, index);
  console.log(`[✓] work copy → ${workBase}.json`);

  if (config.docCode) {
    updateDocCodes(config.docCode, config.corpusDocId);
  }

  return { meta, index, unitCount, termCount, roots: CORPUS_ROOTS };
}

function updateDocCodes(code: string, corpusDocId: string): void {
  if (!fs.existsSync(DOC_CODES_PATH)) {
    console.warn(`[warn] doc-codes.json missing: ${DOC_CODES_PATH}`);
    return;
  }
  const file = readJson<{
    schemaVersion: number;
    description?: string;
    documents: Array<{
      code: string;
      corpusDocId: string | null;
      [k: string]: unknown;
    }>;
  }>(DOC_CODES_PATH);

  const entry = file.documents.find(
    (d) => d.code.toUpperCase() === code.toUpperCase(),
  );
  if (!entry) {
    console.warn(`[warn] doc-codes has no entry for ${code}`);
    return;
  }
  if (entry.corpusDocId === corpusDocId) {
    console.log(`[i] doc-codes ${code}.corpusDocId already ${corpusDocId}`);
    return;
  }
  entry.corpusDocId = corpusDocId;
  writeJson(DOC_CODES_PATH, file, true);
  console.log(`[✓] doc-codes ${code}.corpusDocId → "${corpusDocId}"`);
}

/**
 * Save raw HTML fixture for offline re-runs.
 */
export function saveFixture(relFixturePath: string, html: string): string {
  const abs = path.isAbsolute(relFixturePath)
    ? relFixturePath
    : path.join(SCRIPTS, relFixturePath);
  ensureDir(path.dirname(abs));
  fs.writeFileSync(abs, html, "utf-8");
  console.log(`[✓] fixture → ${abs}`);
  return abs;
}
