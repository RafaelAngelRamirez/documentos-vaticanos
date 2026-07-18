/**
 * Apply OCR residual cleanup (a)+(b) and emit re-OCR queue (c).
 *
 * Usage:
 *   npx ts-node --transpile-only repair_ocr_noise_corpus.ts --inventory
 *   npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply
 *   npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids agustin-18-epistolas-indices-es
 *   npx ts-node --transpile-only repair_ocr_noise_corpus.ts --queue-only
 *
 * Dual-writes documentos/corpus + frontend/src/assets/corpus.
 * Per-doc revisions: documentos/corpus/revisions/ocr-abc/<id>.json
 * Re-OCR queue: documentos/corpus/ocr-reocr-queue.json
 */
import fs from "fs";
import path from "path";
import type { TrasnportData } from "./models/transport_data.model";
import type { CorpusManifest, DocumentMeta } from "./models/corpus.model";
import { buildIndex } from "./src/pipeline/build_index";
import { CORPUS_ROOTS } from "./src/pipeline/write_corpus";
import {
  letterTokenOverlap,
  repairOcrNoiseUnit,
  repairOcrSpacedText,
  scoreDocumentGarbage,
  type DocGarbageMetrics,
} from "./src/pipeline/repair_ocr_noise";

const REPO = path.resolve(__dirname, "..");
const REVISION_TAG = "ocr-abc-v2";
const INVENTORY_PATH = path.join(
  REPO,
  "documentos",
  "corpus",
  "ocr-abc-inventory.json",
);
const QUEUE_PATH = path.join(
  REPO,
  "documentos",
  "corpus",
  "ocr-reocr-queue.json",
);
const REVISIONS_DIR = path.join(
  REPO,
  "documentos",
  "corpus",
  "revisions",
  "ocr-abc",
);

interface InventoryEntry {
  id: string;
  kind?: string;
  units: number;
  metrics: DocGarbageMetrics;
  /** Apply a+b when spaced runs or garbage units above threshold. */
  targetAbc: boolean;
  /** List on re-OCR queue when residual still severe. */
  queueReocr: boolean;
  reason: string;
}

interface RevisionRecord {
  documentId: string;
  revision: string;
  appliedAt: string;
  ruleClasses: string[];
  unitsTotal: number;
  unitsChanged: number;
  unitsExcludedGarbage: number;
  unitsCollapsedSpaced: number;
  before: DocGarbageMetrics;
  after: DocGarbageMetrics;
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
  if (meta.kind === "patristic" || meta.kind === "council") return true;
  if (meta.id.startsWith("agustin-")) return true;
  return false;
}

function loadUnits(docId: string): TrasnportData[] {
  const p = path.join(
    primaryCorpusRoot(),
    "documents",
    docId,
    "content.json",
  );
  if (!fs.existsSync(p)) throw new Error(`missing content: ${p}`);
  const data = readJson<TrasnportData[] | { units: TrasnportData[] }>(p);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { units: TrasnportData[] }).units)) {
    return (data as { units: TrasnportData[] }).units;
  }
  throw new Error(`unexpected content shape: ${p}`);
}

function unitTexts(units: TrasnportData[]): string[] {
  return units.map((u) => u.contenido || "");
}

function buildInventory(
  minSpaced: number,
  minGarbage: number,
  minResidualQueue: number,
): InventoryEntry[] {
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
    const metrics = scoreDocumentGarbage(unitTexts(units));
    const targetAbc =
      metrics.spacedLetterRuns >= minSpaced ||
      metrics.shortSpacedWordHits >= minSpaced ||
      metrics.spacedDigitRuns >= minSpaced ||
      metrics.garbageUnits >= minGarbage;
    // Queue for re-OCR: residual body noise / leftover junk a+b cannot fix
    const queueReocr =
      metrics.residualBodyNoiseUnits >= 8 ||
      metrics.residualScore >= minResidualQueue ||
      metrics.garbageRatio >= 0.015 ||
      metrics.junkRunHits >= 15 ||
      (metrics.garbageUnits >= 5 && metrics.junkRunHits >= 5) ||
      metrics.residualBodyNoiseUnits >= 3 && metrics.junkRunHits >= 5;
    const reasons: string[] = [];
    if (metrics.spacedLetterRuns > 0) {
      reasons.push(`spaced_runs=${metrics.spacedLetterRuns}`);
    }
    if (metrics.shortSpacedWordHits > 0) {
      reasons.push(`short_spaced=${metrics.shortSpacedWordHits}`);
    }
    if (metrics.spacedDigitRuns > 0) {
      reasons.push(`spaced_digits=${metrics.spacedDigitRuns}`);
    }
    if (metrics.garbageUnits > 0) {
      reasons.push(
        `garbage_units=${metrics.garbageUnits}/${metrics.units} (${(metrics.garbageRatio * 100).toFixed(2)}%)`,
      );
    }
    if (metrics.residualBodyNoiseUnits > 0) {
      reasons.push(`body_noise=${metrics.residualBodyNoiseUnits}`);
    }
    if (metrics.junkRunHits > 0) {
      reasons.push(`junk_runs=${metrics.junkRunHits}`);
    }
    if (metrics.tocLeaderHits > 0) {
      reasons.push(`toc_leaders=${metrics.tocLeaderHits}`);
    }
    if (queueReocr) reasons.push("queue:reocr");
    if (!targetAbc && !queueReocr) reasons.push("below-threshold");
    entries.push({
      id: meta.id,
      kind: meta.kind,
      units: units.length,
      metrics,
      targetAbc,
      queueReocr,
      reason: reasons.join("; ") || "ok",
    });
  }
  entries.sort((a, b) => b.metrics.residualScore - a.metrics.residualScore);
  return entries;
}

function applyToDocument(docId: string): RevisionRecord | null {
  const units = loadUnits(docId);
  const before = scoreDocumentGarbage(unitTexts(units));
  if (
    before.spacedLetterRuns === 0 &&
    before.shortSpacedWordHits === 0 &&
    before.spacedDigitRuns === 0 &&
    before.garbageUnits === 0
  ) {
    // Still allow collapse of edge cases: check if any unit would change
    let any = false;
    for (const u of units) {
      if (repairOcrNoiseUnit(u.contenido || "").changed) {
        any = true;
        break;
      }
    }
    if (!any) return null;
  }

  let unitsChanged = 0;
  let unitsExcludedGarbage = 0;
  let unitsCollapsedSpaced = 0;
  const repaired: TrasnportData[] = units.map((u) => {
    const r = repairOcrNoiseUnit(u.contenido || "");
    if (r.changed) unitsChanged += 1;
    if (r.excludedGarbage) unitsExcludedGarbage += 1;
    if (r.collapsedSpaced) unitsCollapsedSpaced += 1;
    return { ...u, contenido: r.contenido };
  });

  if (unitsChanged === 0) return null;

  // Stable unit count / consecutivo (never drop array slots)
  if (repaired.length !== units.length) {
    throw new Error(`unitCount churn for ${docId}`);
  }
  for (let i = 0; i < units.length; i++) {
    if (repaired[i].consecutivo !== units[i].consecutivo) {
      throw new Error(`consecutivo churn at ${docId}#${i}`);
    }
  }

  const beforeText = unitTexts(units).join("\n");
  const afterText = unitTexts(repaired).join("\n");
  // Letter-token overlap: compare only non-excluded units for essence
  const beforeBody = units
    .map((u, i) =>
      repaired[i].contenido ===
      "[OCR: índice o tabla ilegible omitido]" &&
      (u.contenido || "").length > 0
        ? ""
        : u.contenido || "",
    )
    .join("\n");
  const afterBody = repaired
    .map((u) =>
      u.contenido === "[OCR: índice o tabla ilegible omitido]"
        ? ""
        : u.contenido || "",
    )
    .join("\n");
  // For overlap, use full texts but garbage blanking removes tokens intentionally.
  // Report overlap on units that were only spaced-collapsed (not excluded).
  let overlapNum = 0;
  let overlapDen = 0;
  for (let i = 0; i < units.length; i++) {
    const r = repairOcrNoiseUnit(units[i].contenido || "");
    if (r.excludedGarbage) continue;
    const o = letterTokenOverlap(units[i].contenido || "", r.contenido);
    overlapNum += o;
    overlapDen += 1;
  }
  const overlap = overlapDen ? overlapNum / overlapDen : 1;

  const after = scoreDocumentGarbage(unitTexts(repaired));
  const index = buildIndex(repaired);

  const dualRoots: string[] = [];
  for (const root of CORPUS_ROOTS) {
    const docDir = path.join(root, "documents", docId);
    fs.mkdirSync(docDir, { recursive: true });
    writeJson(path.join(docDir, "content.json"), repaired, false);
    writeJson(path.join(docDir, "index.json"), index, false);
    dualRoots.push(root);
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

  // Clean text dual update when present
  for (const cleanRoot of [
    path.join(REPO, "documentos", "padres-source", "clean"),
    path.join(REPO, "documentos", "concilios-source", "clean"),
  ]) {
    const cleanPath = path.join(cleanRoot, `${docId}.txt`);
    if (!fs.existsSync(cleanPath)) continue;
    const clean = fs.readFileSync(cleanPath, "utf-8");
    // Same pure spaced+digit+confusion+punct path as units (no garbage blanking)
    const next = repairOcrSpacedText(clean);
    if (next !== clean) {
      fs.writeFileSync(
        cleanPath,
        next.endsWith("\n") ? next : next + "\n",
        "utf-8",
      );
    }
  }

  const record: RevisionRecord = {
    documentId: docId,
    revision: REVISION_TAG,
    appliedAt: new Date().toISOString(),
    ruleClasses: [
      "spaced-letter-collapse",
      "short-spaced-word-collapse",
      "spaced-digit-collapse",
      "high-confidence-ocr-confusions",
      "garbage-toc-exclude-placeholder",
      "punct-safe-compose",
    ],
    unitsTotal: units.length,
    unitsChanged,
    unitsExcludedGarbage,
    unitsCollapsedSpaced,
    before,
    after,
    letterTokenOverlap: Math.round(overlap * 10000) / 10000,
    dualWriteRoots: dualRoots,
    notes:
      "a) ≥4 spaced letters; a2) short dict words (Tal/que/de); a3) spaced digits/years; a4) qiíe/O'MEARA/p..; b) TOC junk placeholder (stable unitIndex).",
  };
  void beforeText;
  void afterText;
  void beforeBody;
  void afterBody;

  writeJson(path.join(REVISIONS_DIR, `${docId}.json`), record, true);
  return record;
}

function writeQueue(entries: InventoryEntry[]): void {
  const queued = entries.filter((e) => e.queueReocr);
  writeJson(
    QUEUE_PATH,
    {
      generatedAt: new Date().toISOString(),
      revision: REVISION_TAG,
      description:
        "Volumes with high residual OCR garbage after mechanical a+b cleanup — candidates for re-OCR / page re-extract (not run in this goal).",
      count: queued.length,
      documents: queued.map((e) => ({
        id: e.id,
        kind: e.kind,
        residualScore: e.metrics.residualScore,
        garbageUnits: e.metrics.garbageUnits,
        garbageRatio: e.metrics.garbageRatio,
        residualBodyNoiseUnits: e.metrics.residualBodyNoiseUnits,
        spacedLetterRuns: e.metrics.spacedLetterRuns,
        junkRunHits: e.metrics.junkRunHits,
        tocLeaderHits: e.metrics.tocLeaderHits,
        units: e.metrics.units,
        reason: e.reason,
        suggestedAction:
          e.metrics.residualBodyNoiseUnits >= 15
            ? "re-ocr-body-pages"
            : e.metrics.junkRunHits >= 15 || e.metrics.garbageUnits >= 5
              ? "re-ocr-or-slice-index-pages"
              : "spot-check-then-re-ocr-if-body-noise",
      })),
    },
    true,
  );
  console.log(`[✓] re-OCR queue → ${QUEUE_PATH} (${queued.length} docs)`);
}

function main(): void {
  const doApply = hasFlag("--apply");
  const queueOnly = hasFlag("--queue-only");
  const minSpaced = Number(argValue("--min-spaced") || "1");
  const minGarbage = Number(argValue("--min-garbage") || "1");
  const minResidualQueue = Number(argValue("--min-residual-queue") || "30");
  const idsArg = argValue("--ids");
  const idFilter = idsArg
    ? new Set(idsArg.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  console.log(
    `[i] min-spaced=${minSpaced} min-garbage=${minGarbage} min-residual-queue=${minResidualQueue} apply=${doApply}`,
  );

  const inventory = buildInventory(minSpaced, minGarbage, minResidualQueue);
  writeJson(INVENTORY_PATH, {
    generatedAt: new Date().toISOString(),
    revision: REVISION_TAG,
    minSpaced,
    minGarbage,
    minResidualQueue,
    count: inventory.length,
    targetAbcCount: inventory.filter((e) => e.targetAbc).length,
    queueReocrCount: inventory.filter((e) => e.queueReocr).length,
    documents: inventory,
  });
  console.log(
    `[✓] inventory → ${INVENTORY_PATH} (${inventory.length} ocr-derived, ${inventory.filter((e) => e.targetAbc).length} a+b targets, ${inventory.filter((e) => e.queueReocr).length} reocr-queue)`,
  );

  writeQueue(inventory);

  if (!doApply || queueOnly) {
    for (const e of inventory.slice(0, 20)) {
      const mark = e.targetAbc ? "*" : e.queueReocr ? "Q" : " ";
      console.log(
        `  ${mark} ${e.id.padEnd(42)} residual=${String(e.metrics.residualScore).padStart(5)} spaced=${String(e.metrics.spacedLetterRuns).padStart(4)} garbage=${e.metrics.garbageUnits}  ${e.reason.slice(0, 80)}`,
      );
    }
    if (!doApply) return;
  }

  let targets = inventory.filter((e) => {
    if (idFilter && !idFilter.has(e.id)) return false;
    return e.targetAbc || (idFilter != null && idFilter.has(e.id));
  });
  if (idFilter) {
    for (const id of idFilter) {
      if (!targets.some((t) => t.id === id)) {
        targets.push({
          id,
          units: 0,
          metrics: scoreDocumentGarbage([]),
          targetAbc: true,
          queueReocr: false,
          reason: "explicit --ids",
        });
      }
    }
  }

  console.log(`[i] applying a+b to ${targets.length} document(s)`);
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
        `changed ${rev.unitsChanged}/${rev.unitsTotal} (spaced=${rev.unitsCollapsedSpaced} garbage=${rev.unitsExcludedGarbage}); spaced_runs ${rev.before.spacedLetterRuns}→${rev.after.spacedLetterRuns}; garbage ${rev.before.garbageUnits}→${rev.after.garbageUnits}; overlap=${rev.letterTokenOverlap}`,
      );
    } catch (err) {
      console.log(`ERROR ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  // Rebuild queue from post-apply inventory
  const postInv = buildInventory(minSpaced, minGarbage, minResidualQueue);
  writeJson(INVENTORY_PATH, {
    generatedAt: new Date().toISOString(),
    revision: REVISION_TAG,
    minSpaced,
    minGarbage,
    minResidualQueue,
    count: postInv.length,
    targetAbcCount: postInv.filter((e) => e.targetAbc).length,
    queueReocrCount: postInv.filter((e) => e.queueReocr).length,
    documents: postInv,
    note: "inventory after last apply",
  });
  writeQueue(postInv);

  // Summary from all revision files
  const allRevs: RevisionRecord[] = [];
  if (fs.existsSync(REVISIONS_DIR)) {
    for (const name of fs.readdirSync(REVISIONS_DIR)) {
      if (!name.endsWith(".json") || name === "_summary.json") continue;
      try {
        allRevs.push(readJson(path.join(REVISIONS_DIR, name)));
      } catch {
        /* skip */
      }
    }
  }
  allRevs.sort((a, b) => a.documentId.localeCompare(b.documentId));
  const summaryPath = path.join(REVISIONS_DIR, "_summary.json");
  writeJson(
    summaryPath,
    {
      revision: REVISION_TAG,
      appliedAt: new Date().toISOString(),
      documentCount: allRevs.length,
      thisRunChanged: revisions.length,
      documents: allRevs.map((r) => ({
        id: r.documentId,
        unitsChanged: r.unitsChanged,
        unitsExcludedGarbage: r.unitsExcludedGarbage,
        unitsCollapsedSpaced: r.unitsCollapsedSpaced,
        spacedBefore: r.before.spacedLetterRuns,
        spacedAfter: r.after.spacedLetterRuns,
        garbageBefore: r.before.garbageUnits,
        garbageAfter: r.after.garbageUnits,
        letterTokenOverlap: r.letterTokenOverlap,
      })),
    },
    true,
  );
  console.log(
    `[✓] ${revisions.length} changed this run; ${allRevs.length} revision file(s) → ${REVISIONS_DIR}`,
  );
}

main();
