/**
 * Inventory + apply OCR punctuation repair to corpus packs (stable unitIndex).
 *
 * Usage:
 *   npx ts-node --transpile-only repair_ocr_punctuation_corpus.ts --inventory
 *   npx ts-node --transpile-only repair_ocr_punctuation_corpus.ts --apply
 *   npx ts-node --transpile-only repair_ocr_punctuation_corpus.ts --apply --ids agustin-02-confesiones-es,cipriano-cartas-es
 *   npx ts-node --transpile-only repair_ocr_punctuation_corpus.ts --apply --min-defect 5
 *
 * Dual-writes documentos/corpus + frontend/src/assets/corpus.
 * Writes one revision JSON per changed document id.
 */
import fs from "fs";
import path from "path";
import type { TrasnportData } from "./models/transport_data.model";
import type { CorpusManifest, DocumentMeta } from "./models/corpus.model";
import { buildIndex } from "./src/pipeline/build_index";
import { CORPUS_ROOTS } from "./src/pipeline/write_corpus";
import {
  letterTokenOverlap,
  repairOcrPunctuation,
  scoreOcrPunctuation,
  type OcrPunctMetrics,
} from "./src/pipeline/repair_ocr_punctuation";

const REPO = path.resolve(__dirname, "..");
const REVISION_TAG = "ocr-punct-v1";
const INVENTORY_PATH = path.join(
  REPO,
  "documentos",
  "corpus",
  "ocr-punct-inventory.json",
);
const REVISIONS_DIR = path.join(
  REPO,
  "documentos",
  "corpus",
  "revisions",
  "ocr-punct",
);

interface InventoryEntry {
  id: string;
  kind?: string;
  locale?: string;
  sourceNote?: string;
  units: number;
  metrics: OcrPunctMetrics;
  target: boolean;
  reason: string;
}

interface RevisionRecord {
  documentId: string;
  revision: string;
  appliedAt: string;
  ruleClasses: string[];
  unitsTotal: number;
  unitsChanged: number;
  before: OcrPunctMetrics;
  after: OcrPunctMetrics;
  letterTokenOverlap: number;
  dualWriteRoots: string[];
  notes: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown, pretty = true): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    pretty ? JSON.stringify(data, null, 2) + "\n" : JSON.stringify(data),
    "utf-8",
  );
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function primaryCorpusRoot(): string {
  return path.join(REPO, "documentos", "corpus");
}

function loadManifest(): CorpusManifest {
  return readJson(path.join(primaryCorpusRoot(), "manifest.json"));
}

function isOcrDerived(meta: DocumentMeta): boolean {
  const note = `${meta.sourceNote || ""} ${meta.sourceUrl || ""}`.toLowerCase();
  if (/\bocr\b|tesseract|pdftotext|image.?pdf|mansi|djvu/.test(note)) {
    return true;
  }
  // Packs known to come from OCR/PDF pipeline
  if (meta.kind === "patristic") return true;
  if (meta.kind === "council") return true;
  if (meta.id.startsWith("agustin-")) return true;
  if (/-(la|es)$/.test(meta.id) && meta.kind === "council") return true;
  return false;
}

function loadUnits(docId: string): TrasnportData[] {
  const p = path.join(
    primaryCorpusRoot(),
    "documents",
    docId,
    "content.json",
  );
  if (!fs.existsSync(p)) {
    throw new Error(`missing content: ${p}`);
  }
  const data = readJson<TrasnportData[] | { units: TrasnportData[] }>(p);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { units: TrasnportData[] }).units)) {
    return (data as { units: TrasnportData[] }).units;
  }
  throw new Error(`unexpected content shape: ${p}`);
}

function joinContenido(units: TrasnportData[]): string {
  return units.map((u) => u.contenido || "").join("\n");
}

function buildInventory(minDefect: number): InventoryEntry[] {
  const manifest = loadManifest();
  const entries: InventoryEntry[] = [];
  for (const meta of manifest.documents || []) {
    if (!isOcrDerived(meta)) continue;
    const contentPath = path.join(
      primaryCorpusRoot(),
      "documents",
      meta.id,
      "content.json",
    );
    if (!fs.existsSync(contentPath)) continue;
    let units: TrasnportData[];
    try {
      units = loadUnits(meta.id);
    } catch {
      continue;
    }
    const full = joinContenido(units);
    const metrics = scoreOcrPunctuation(full);
    const target = metrics.defectScore >= minDefect;
    const reasons: string[] = [];
    if (metrics.spaceBeforePunct > 0) {
      reasons.push(`space-before-punct=${metrics.spaceBeforePunct}`);
    }
    if (metrics.gluedClausePunct > 0) {
      reasons.push(`glued-clause=${metrics.gluedClausePunct}`);
    }
    if (metrics.missingSentenceSpace > 0) {
      reasons.push(`missing-sentence-space=${metrics.missingSentenceSpace}`);
    }
    if (metrics.internalWordPeriod > 0) {
      reasons.push(`internal-word-period=${metrics.internalWordPeriod}`);
    }
    if (!target) reasons.push("below-threshold");
    entries.push({
      id: meta.id,
      kind: meta.kind,
      locale: meta.locale,
      sourceNote: meta.sourceNote,
      units: units.length,
      metrics,
      target,
      reason: reasons.join("; ") || "ok",
    });
  }
  entries.sort((a, b) => b.metrics.defectScore - a.metrics.defectScore);
  return entries;
}

function applyToDocument(docId: string): RevisionRecord | null {
  const units = loadUnits(docId);
  const beforeText = joinContenido(units);
  const before = scoreOcrPunctuation(beforeText);
  if (before.defectScore === 0) {
    return null;
  }

  let unitsChanged = 0;
  const repaired: TrasnportData[] = units.map((u) => {
    const original = u.contenido || "";
    const next = repairOcrPunctuation(original);
    if (next !== original) unitsChanged += 1;
    return { ...u, contenido: next };
  });

  if (unitsChanged === 0) {
    return null;
  }

  // Stable unit count / indices: same array length, same consecutivo
  if (repaired.length !== units.length) {
    throw new Error(`unitCount churn for ${docId}`);
  }
  for (let i = 0; i < units.length; i++) {
    if (repaired[i].consecutivo !== units[i].consecutivo) {
      throw new Error(`consecutivo churn at ${docId}#${i}`);
    }
  }

  const afterText = joinContenido(repaired);
  const after = scoreOcrPunctuation(afterText);
  const overlap = letterTokenOverlap(beforeText, afterText);
  const index = buildIndex(repaired);

  // Dual-write content + index (keep meta as-is; update unitCount if needed)
  const dualRoots: string[] = [];
  for (const root of CORPUS_ROOTS) {
    const docDir = path.join(root, "documents", docId);
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }
    writeJson(path.join(docDir, "content.json"), repaired, false);
    writeJson(path.join(docDir, "index.json"), index, false);
    dualRoots.push(root);

    // Touch manifest generatedAt only (meta unitCount unchanged)
    const manifestPath = path.join(root, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = readJson<CorpusManifest>(manifestPath);
        manifest.generatedAt = new Date().toISOString();
        writeJson(manifestPath, manifest, false);
      } catch {
        /* ignore */
      }
    }
  }

  // Also dual-write clean text if padres/concilios clean file exists
  for (const cleanRoot of [
    path.join(REPO, "documentos", "padres-source", "clean"),
    path.join(REPO, "documentos", "concilios-source", "clean"),
  ]) {
    const cleanPath = path.join(cleanRoot, `${docId}.txt`);
    if (fs.existsSync(cleanPath)) {
      const clean = fs.readFileSync(cleanPath, "utf-8");
      const cleaned = repairOcrPunctuation(clean);
      if (cleaned !== clean) {
        fs.writeFileSync(cleanPath, cleaned.endsWith("\n") ? cleaned : cleaned + "\n", "utf-8");
      }
    }
  }

  const record: RevisionRecord = {
    documentId: docId,
    revision: REVISION_TAG,
    appliedAt: new Date().toISOString(),
    ruleClasses: [
      "space-before-punct",
      "glued-clause-punct",
      "ellipsis-leaders",
      "internal-word-period",
      "missing-sentence-space",
    ],
    unitsTotal: units.length,
    unitsChanged,
    before,
    after,
    letterTokenOverlap: Math.round(overlap * 10000) / 10000,
    dualWriteRoots: dualRoots,
    notes:
      "Mechanical OCR punctuation spacing repair only; unitIndex stable; no re-segmentation.",
  };

  writeJson(path.join(REVISIONS_DIR, `${docId}.json`), record, true);
  return record;
}

function main(): void {
  const doInventory = hasFlag("--inventory") || !hasFlag("--apply");
  const doApply = hasFlag("--apply");
  const minDefect = Number(argValue("--min-defect") || "1");
  const idsArg = argValue("--ids");
  const idFilter = idsArg
    ? new Set(idsArg.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  console.log(`[i] min-defect=${minDefect} apply=${doApply}`);

  const inventory = buildInventory(minDefect);
  writeJson(INVENTORY_PATH, {
    generatedAt: new Date().toISOString(),
    minDefect,
    revision: REVISION_TAG,
    count: inventory.length,
    targetCount: inventory.filter((e) => e.target).length,
    documents: inventory,
  });
  console.log(
    `[✓] inventory → ${INVENTORY_PATH} (${inventory.length} ocr-derived, ${inventory.filter((e) => e.target).length} targets)`,
  );

  if (doInventory && !doApply) {
    for (const e of inventory.slice(0, 25)) {
      console.log(
        `  ${e.target ? "*" : " "} ${e.id.padEnd(42)} defect=${String(e.metrics.defectScore).padStart(6)}  ${e.reason}`,
      );
    }
    return;
  }

  const targets = inventory.filter((e) => {
    if (!e.target) return false;
    if (idFilter && !idFilter.has(e.id)) return false;
    return true;
  });

  if (idFilter) {
    for (const id of idFilter) {
      if (!targets.some((t) => t.id === id) && inventory.some((e) => e.id === id)) {
        // force include explicit ids even if below threshold
        const e = inventory.find((x) => x.id === id)!;
        targets.push(e);
      } else if (!inventory.some((e) => e.id === id)) {
        // id may still exist in corpus but not classified ocr — try apply
        targets.push({
          id,
          units: 0,
          metrics: scoreOcrPunctuation(""),
          target: true,
          reason: "explicit --ids",
        });
      }
    }
  }

  console.log(`[i] applying repair to ${targets.length} document(s)`);
  const revisions: RevisionRecord[] = [];
  for (const t of targets) {
    process.stdout.write(`  → ${t.id} ... `);
    try {
      const rev = applyToDocument(t.id);
      if (!rev) {
        console.log("no-op");
        continue;
      }
      revisions.push(rev);
      console.log(
        `changed ${rev.unitsChanged}/${rev.unitsTotal} units; defect ${rev.before.defectScore}→${rev.after.defectScore}; overlap=${rev.letterTokenOverlap}`,
      );
    } catch (err) {
      console.log(`ERROR ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  const summaryPath = path.join(REVISIONS_DIR, "_summary.json");
  writeJson(
    summaryPath,
    {
      revision: REVISION_TAG,
      appliedAt: new Date().toISOString(),
      documentCount: revisions.length,
      documents: revisions.map((r) => ({
        id: r.documentId,
        unitsChanged: r.unitsChanged,
        defectBefore: r.before.defectScore,
        defectAfter: r.after.defectScore,
        letterTokenOverlap: r.letterTokenOverlap,
      })),
    },
    true,
  );
  console.log(`[✓] ${revisions.length} revision(s) → ${REVISIONS_DIR}`);
  console.log(`[✓] summary → ${summaryPath}`);
}

main();
