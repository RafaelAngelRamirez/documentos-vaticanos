/**
 * Write a scraped document into the versioned corpus layout and merge manifest.
 * Also updates doc-codes.json corpusDocId when source.docCode is set.
 *
 * Canonical pack is documentos/corpus/. frontend/src/assets/corpus/ is a ship
 * copy (syncDocToAssets / npm run corpus:sync-assets). Do not copy OCR
 * inventories, revisions/, pending-documents.json, or unlinked-refs-worksheet.json.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { CorpusUnit } from "../../models/transport_data.model";
import type {
  CorpusIndex,
  CorpusManifest,
  DocumentMeta,
} from "../../models/corpus.model";
import type { SourceConfig } from "../adapters/types";
import { buildIndex } from "./build_index";
import { upsertDownload } from "./document_registry";
import { looksLikeAiDisclaimer } from "./locale_provenance";

const REPO = path.resolve(__dirname, "../../..");
const SCRIPTS = path.resolve(__dirname, "../..");

export const CANONICAL_CORPUS_ROOT = path.join(REPO, "documentos", "corpus");
export const ASSETS_CORPUS_ROOT = path.join(
  REPO,
  "frontend",
  "src",
  "assets",
  "corpus",
);
/** [canonical, assets]. Assets is a copy, not a second writer. */
export const CORPUS_ROOTS = [CANONICAL_CORPUS_ROOT, ASSETS_CORPUS_ROOT];

function assertCorpusRelPath(relPath: string): string {
  if (!relPath || path.isAbsolute(relPath)) {
    throw new Error(
      `syncCorpusPathToAssets: relative path required, got ${JSON.stringify(relPath)}`,
    );
  }
  const normalized = path.normalize(relPath);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(
      `syncCorpusPathToAssets: path escapes corpus root: ${relPath}`,
    );
  }
  const posix = normalized.split(path.sep).join("/");
  const base = path.posix.basename(posix);
  if (
    posix === "pending-documents.json" ||
    posix === "unlinked-refs-worksheet.json" ||
    posix === "revisions" ||
    posix.startsWith("revisions/") ||
    /^ocr-.*-inventory\.json$/.test(base)
  ) {
    throw new Error(
      `syncCorpusPathToAssets: ${relPath} is canonical-only (not a ship path)`,
    );
  }
  return normalized;
}

/**
 * Copy a file or directory from documentos/corpus into the Angular ship tree.
 */
export function syncCorpusPathToAssets(relPath: string): void {
  const rel = assertCorpusRelPath(relPath);
  const src = path.join(CANONICAL_CORPUS_ROOT, rel);
  const dest = path.join(ASSETS_CORPUS_ROOT, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`syncCorpusPathToAssets: missing ${src}`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

export function syncDocToAssets(docId: string): void {
  if (!docId || docId.includes("/") || docId.includes(path.sep)) {
    throw new Error(`syncDocToAssets: invalid document id ${JSON.stringify(docId)}`);
  }
  syncCorpusPathToAssets(path.join("documents", docId));
}

export function syncManifestToAssets(): void {
  syncCorpusPathToAssets("manifest.json");
}

/** First 12 hex chars of sha256 — stamped on DocumentMeta.contentHash. */
export const CONTENT_HASH_LEN = 12;

export function hashContentBytes(buf: Buffer | string): string {
  return crypto
    .createHash("sha256")
    .update(buf)
    .digest("hex")
    .slice(0, CONTENT_HASH_LEN);
}

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
 * Persist content + index + meta for one source into the canonical corpus,
 * then copy that document and the merged manifest into assets.
 */
export function writeCorpusDocument(
  config: SourceConfig,
  units: CorpusUnit[],
  options?: { corpusVersion?: string },
): WriteCorpusResult {
  const index = buildIndex(units);
  const unitCount = units.length;
  const termCount = Object.keys(index.indice).length;

  const relBody = `documents/${config.corpusDocId}/content.json`;
  const relIndex = `documents/${config.corpusDocId}/index.json`;
  const relMeta = `documents/${config.corpusDocId}/meta.json`;

  const contentHash = hashContentBytes(JSON.stringify(units));
  const meta: DocumentMeta = {
    id: config.corpusDocId,
    title: config.title,
    shortTitle: config.shortTitle,
    kind: config.kind,
    locale: config.locale,
    sourceUrl: config.seedUrls?.[0],
    bodyPath: relBody,
    indexPath: relIndex,
    unitCount,
    contentHash,
  };
  if (config.author) meta.author = config.author;
  if (config.compiler) meta.compiler = config.compiler;
  if (config.sourceNote) meta.sourceNote = config.sourceNote;
  else if (config.notes) meta.sourceNote = config.notes;
  if (config.translationProvenance) {
    meta.translationProvenance = config.translationProvenance;
  }
  // Never stamp official on a pack whose note is an AI-translation disclaimer.
  if (
    meta.translationProvenance === "official" &&
    looksLikeAiDisclaimer(meta.sourceNote)
  ) {
    meta.translationProvenance = "ai";
  }

  const root = CANONICAL_CORPUS_ROOT;
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

  syncDocToAssets(config.corpusDocId);
  syncManifestToAssets();
  console.log(
    `[✓] assets copy → ${path.join(ASSETS_CORPUS_ROOT, "documents", config.corpusDocId)}`,
  );

  // Working copy under scripts-descarga/documentos/
  const workBase = path.join(SCRIPTS, "documentos", config.corpusDocId);
  writeJson(`${workBase}.json`, units);
  writeJson(`${workBase}.index.json`, index);
  console.log(`[✓] work copy → ${workBase}.json`);

  if (config.docCode) {
    updateDocCodes(config.docCode, config.corpusDocId);
  }

  // Track download in repo-local registry (documentos/registry/downloaded-documents.json)
  try {
    upsertDownload({
      id: config.corpusDocId,
      sourceId: config.id,
      title: config.title,
      kind: config.kind,
      locale: config.locale,
      sourceUrls: config.seedUrls ?? [],
      unitCount,
      status: "active",
      corpusPaths: {
        content: relBody,
        index: relIndex,
        meta: relMeta,
      },
      notes: config.notes ?? "",
    });
  } catch (err) {
    console.warn(
      `[warn] document registry upsert failed:`,
      (err as Error).message,
    );
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
