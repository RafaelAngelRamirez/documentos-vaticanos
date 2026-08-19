/**
 * Campaign sampler CLI: stratified sample + 25%/60% decisions.
 *
 *   npx ts-node --transpile-only sample_corpus_review.ts --inventory
 *   npx ts-node --transpile-only sample_corpus_review.ts --inventory --limit 20
 *   npx ts-node --transpile-only sample_corpus_review.ts --ids agustin-02-confesiones-es --apply-sample-fixes
 *
 * Does not re-OCR. Dual-write content only when --apply-sample-fixes and
 * decision is sample-pass or full-review (mechanical a+b). Re-OCR ids are listed.
 */
import fs from "fs";
import path from "path";
import type { TrasnportData } from "./models/transport_data.model";
import type { CorpusManifest } from "./models/corpus.model";
import { buildIndex } from "./src/pipeline/build_index";
import { CORPUS_ROOTS } from "./src/pipeline/write_corpus";
import { repairOcrNoiseUnit } from "./src/pipeline/repair_ocr_noise";
import {
  heuristicOkRate,
  judgeSample,
  type SampleJudgement,
} from "./src/pipeline/sample_corpus_review";

const REPO = path.resolve(__dirname, "..");
const INVENTORY_PATH = path.join(
  REPO,
  "documentos",
  "corpus",
  "ocr-sample-inventory.json",
);

interface CampaignEntry {
  id: string;
  units: number;
  sampleSize: number;
  damagedRate: number;
  ocrIllegibleRate: number;
  decision: SampleJudgement["decision"];
  heuristicOkRate: number;
  meets95: boolean;
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

function loadUnits(docId: string): TrasnportData[] {
  const p = path.join(primaryCorpusRoot(), "documents", docId, "content.json");
  if (!fs.existsSync(p)) throw new Error(`missing content: ${p}`);
  const data = readJson<TrasnportData[] | { units: TrasnportData[] }>(p);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { units: TrasnportData[] }).units)) {
    return (data as { units: TrasnportData[] }).units;
  }
  throw new Error(`unexpected content shape: ${p}`);
}

function dualWrite(docId: string, units: TrasnportData[]): void {
  const index = buildIndex(units);
  for (const root of CORPUS_ROOTS) {
    const docDir = path.join(root, "documents", docId);
    if (!fs.existsSync(docDir)) continue;
    writeJson(path.join(docDir, "content.json"), units, false);
    writeJson(path.join(docDir, "index.json"), index, false);
  }
}

function applyMechanical(units: TrasnportData[]): {
  next: TrasnportData[];
  changed: number;
} {
  let changed = 0;
  const next = units.map((u) => {
    const r = repairOcrNoiseUnit(u.contenido || "");
    if (r.changed) changed += 1;
    return { ...u, contenido: r.contenido };
  });
  return { next, changed };
}

function main(): void {
  const manifest = readJson<CorpusManifest>(
    path.join(primaryCorpusRoot(), "manifest.json"),
  );
  const docs = manifest.documents || [];
  const onlyIds = argValue("--ids")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Number(argValue("--limit") || "0") || 0;
  const apply = hasFlag("--apply-sample-fixes");

  const entries: CampaignEntry[] = [];
  const reocr: string[] = [];
  const fullReview: string[] = [];
  let scanned = 0;

  for (const meta of docs) {
    if (onlyIds && !onlyIds.includes(meta.id)) continue;
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
    const texts = units.map((u) => u.contenido || "");
    const j = judgeSample(meta.id, texts);
    const okRate = heuristicOkRate(texts);
    entries.push({
      id: meta.id,
      units: units.length,
      sampleSize: j.sampleSize,
      damagedRate: j.damagedRate,
      ocrIllegibleRate: j.ocrIllegibleRate,
      decision: j.decision,
      heuristicOkRate: Math.round(okRate * 10000) / 10000,
      meets95: okRate >= 0.95,
    });
    if (j.decision === "reocr") reocr.push(meta.id);
    if (j.decision === "full-review") fullReview.push(meta.id);

    if (apply && j.decision !== "reocr") {
      const { next, changed } = applyMechanical(units);
      if (changed > 0) {
        dualWrite(meta.id, next);
        console.log(`applied ${meta.id}: ${changed} units changed`);
      }
    }

    scanned += 1;
    if (limit && scanned >= limit) break;
  }

  entries.sort((a, b) => a.heuristicOkRate - b.heuristicOkRate);
  const total = entries.length;
  const ok95 = entries.filter((e) => e.meets95).length;
  const coverage = total ? ok95 / total : 0;
  const remaining = entries.filter((e) => !e.meets95).map((e) => e.id);

  const report = {
    generatedAt: new Date().toISOString(),
    scanned: total,
    packsAtLeast95Ok: ok95,
    campaignCoverage: Math.round(coverage * 10000) / 10000,
    target90: coverage >= 0.9,
    reocrQueue: reocr,
    fullReviewQueue: fullReview,
    remainingWorstFirst: remaining,
    entries,
  };
  writeJson(INVENTORY_PATH, report, true);
  console.log(
    JSON.stringify(
      {
        scanned: total,
        packsAtLeast95Ok: ok95,
        campaignCoverage: report.campaignCoverage,
        target90: report.target90,
        reocr: reocr.length,
        fullReview: fullReview.length,
        remaining: remaining.length,
        inventory: INVENTORY_PATH,
        sample: entries.slice(0, 8).map((e) => ({
          id: e.id,
          decision: e.decision,
          damagedRate: e.damagedRate,
          ocrIllegibleRate: e.ocrIllegibleRate,
          heuristicOkRate: e.heuristicOkRate,
          sampleSize: e.sampleSize,
        })),
      },
      null,
      2,
    ),
  );
}

main();
