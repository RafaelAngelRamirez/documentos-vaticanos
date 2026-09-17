/**
 * Offline migrator: copies catecismo + biblia JSON into the versioned corpus layout.
 * No network. Keeps Article-compatible body shape for the UI.
 *
 * Usage: npx ts-node --transpile-only migrate_to_corpus.ts
 *    or: npm run migrate:corpus
 */
import fs from "fs";
import path from "path";
import type {
  CorpusIndex,
  CorpusManifest,
  DocumentMeta,
} from "./models/corpus.model";
import {
  CANONICAL_CORPUS_ROOT,
  CORPUS_ROOTS,
  syncDocToAssets,
  syncManifestToAssets,
} from "./src/pipeline/write_corpus";

const CORPUS_VERSION = "1.0.0";

interface SourceDoc {
  id: string;
  title: string;
  shortTitle: string;
  kind: DocumentMeta["kind"];
  locale: string;
  /** Basename without extension under scripts-descarga/documentos/ */
  sourceBase: string;
}

const SOURCES: SourceDoc[] = [
  {
    id: "cic-es",
    title: "Catecismo de la Iglesia Católica",
    shortTitle: "Catecismo",
    kind: "catechism",
    locale: "es",
    sourceBase: "catecismo",
  },
  {
    id: "bible-pueblo-de-dios-es",
    title: "Biblia (Pueblo de Dios)",
    shortTitle: "Biblia",
    kind: "bible",
    locale: "es",
    sourceBase: "biblia_pueblo_de_Dios",
  },
];

const sourceDir = path.join(__dirname, "documentos");

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing source file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
}

function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * Ensures index has { indice, indice_por_punto }.
 * Flat maps are not auto-fixed: user must run reindex first.
 */
function normalizeIndex(raw: unknown, label: string): CorpusIndex {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      `[${label}] index is not an object. Run: npm run reindex`,
    );
  }
  const obj = raw as Record<string, unknown>;
  if (!("indice" in obj) || !("indice_por_punto" in obj)) {
    throw new Error(
      `[${label}] index missing { indice, indice_por_punto }. ` +
        `Run offline reindex first: npm run reindex`,
    );
  }
  if (
    typeof obj.indice !== "object" ||
    obj.indice === null ||
    Array.isArray(obj.indice)
  ) {
    throw new Error(`[${label}] index.indice must be a term → number[] map`);
  }
  if (
    typeof obj.indice_por_punto !== "object" ||
    obj.indice_por_punto === null ||
    Array.isArray(obj.indice_por_punto)
  ) {
    throw new Error(
      `[${label}] index.indice_por_punto must be an arrayIndex → number map`,
    );
  }
  return {
    indice: obj.indice as CorpusIndex["indice"],
    indice_por_punto: obj.indice_por_punto as CorpusIndex["indice_por_punto"],
  };
}

function migrateOne(
  source: SourceDoc,
): { meta: DocumentMeta; termCount: number; puntoCount: number } {
  const bodySrc = path.join(sourceDir, `${source.sourceBase}.json`);
  const indexSrc = path.join(sourceDir, `${source.sourceBase}.index.json`);

  console.log(`[+] ${source.id}: reading body ${bodySrc}`);
  const body = readJson<unknown[]>(bodySrc);
  if (!Array.isArray(body)) {
    throw new Error(`[${source.id}] body must be an Article[] array`);
  }
  const unitCount = body.length;

  console.log(`[+] ${source.id}: reading index ${indexSrc}`);
  const indexRaw = readJson<unknown>(indexSrc);
  const index = normalizeIndex(indexRaw, source.id);
  const termCount = Object.keys(index.indice).length;
  const puntoCount = Object.keys(index.indice_por_punto).length;

  const relBody = `documents/${source.id}/content.json`;
  const relIndex = `documents/${source.id}/index.json`;
  const relMeta = `documents/${source.id}/meta.json`;

  const meta: DocumentMeta = {
    id: source.id,
    title: source.title,
    shortTitle: source.shortTitle,
    kind: source.kind,
    locale: source.locale,
    bodyPath: relBody,
    indexPath: relIndex,
    unitCount,
  };

  const root = CANONICAL_CORPUS_ROOT;
  const docDir = path.join(root, "documents", source.id);
  ensureDir(docDir);
  copyFile(bodySrc, path.join(root, relBody));
  writeJson(path.join(root, relIndex), index);
  writeJson(path.join(root, relMeta), meta);
  syncDocToAssets(source.id);
  console.log(`[✓] ${source.id}: wrote content/index/meta → ${docDir}`);

  console.log(
    `[✓] ${source.id}: units=${unitCount}, términos=${termCount}, puntos_mapeados=${puntoCount}`,
  );

  return { meta, termCount, puntoCount };
}

function main(): void {
  console.log("[+] migrate_to_corpus: offline, no network");
  console.log(`[+] source: ${sourceDir}`);
  console.log(`[+] canonical: ${CANONICAL_CORPUS_ROOT}`);
  ensureDir(path.join(CANONICAL_CORPUS_ROOT, "documents"));

  const documents: DocumentMeta[] = [];
  const stats: {
    id: string;
    unitCount: number;
    termCount: number;
    puntoCount: number;
  }[] = [];

  for (const source of SOURCES) {
    const { meta, termCount, puntoCount } = migrateOne(source);
    documents.push(meta);
    stats.push({
      id: meta.id,
      unitCount: meta.unitCount ?? 0,
      termCount,
      puntoCount,
    });
  }

  const manifest: CorpusManifest = {
    version: CORPUS_VERSION,
    generatedAt: new Date().toISOString(),
    documents,
  };

  const manifestPath = path.join(CANONICAL_CORPUS_ROOT, "manifest.json");
  writeJson(manifestPath, manifest);
  syncManifestToAssets();
  console.log(`[✓] manifest → ${manifestPath}`);
  console.log(`[✓] assets copy → ${CORPUS_ROOTS[1]}`);

  console.log("");
  console.log("=== Corpus migration stats ===");
  console.log(`version: ${manifest.version}`);
  console.log(`generatedAt: ${manifest.generatedAt}`);
  for (const s of stats) {
    console.log(
      `  ${s.id}: units=${s.unitCount}, index_terms=${s.termCount}, mapped_points=${s.puntoCount}`,
    );
  }
  console.log(
    `total units: ${stats.reduce((a, s) => a + s.unitCount, 0)}`,
  );
  console.log("[✓] migrate_to_corpus completed");
}

main();
