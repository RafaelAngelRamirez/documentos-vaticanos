/**
 * Download (if needed) + extract + import one or more Agustín BAC volumes
 * from inventory/agustin-volumes.json into the corpus.
 *
 *   npx ts-node --transpile-only import_agustin_volume.ts --n 2
 *   npx ts-node --transpile-only import_agustin_volume.ts --n 2,16,17
 *   npx ts-node --transpile-only import_agustin_volume.ts --all-priority
 *   npx ts-node --transpile-only import_agustin_volume.ts --n 2 --skip-download
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import {
  plainTextToUnits,
  rejoinHyphenation,
  softNormalize,
  stripPdfChrome,
} from "./src/pipeline/plain_text_units";
import type { SourceConfig } from "./src/adapters/types";

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "documentos/padres-source");
const INV = path.join(SOURCE_ROOT, "inventory/agustin-volumes.json");
const PDF_DIR = path.join(SOURCE_ROOT, "pdf");
const RAW_DIR = path.join(SOURCE_ROOT, "raw");
const CLEAN_DIR = path.join(SOURCE_ROOT, "clean");
const DL_SCRIPT = path.join(__dirname, "download_drive_pdf.sh");

const COMPILER = "A. Cedano";
const PRIORITY = [2, 16, 17, 5, 1, 12]; // Confesiones, Ciudad Dios, Trinitate, primeros, morales

interface Volume {
  n: number;
  driveFileId: string;
  resourceKey?: string;
  name: string;
  sizeBytes?: number;
  corpusDocId: string;
  title?: string;
  status?: string;
  author?: string;
  compiler?: string;
  sourceUrl?: string;
}

interface AgustinInv {
  volumes: Volume[];
  compiler?: string;
  description?: string;
  driveFolderId?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function ensureDirs(): void {
  for (const d of [PDF_DIR, RAW_DIR, CLEAN_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function pdfName(v: Volume): string {
  return `agustin-${String(v.n).padStart(2, "0")}.pdf`;
}

function download(v: Volume): string {
  const out = path.join(PDF_DIR, pdfName(v));
  if (fs.existsSync(out) && fs.statSync(out).size > 10_000) {
    console.log(`[i] PDF already present: ${out}`);
    return out;
  }
  console.log(`[↓] downloading n=${v.n} ${v.name}…`);
  execFileSync(
    "bash",
    [DL_SCRIPT, v.driveFileId, pdfName(v), v.resourceKey ?? ""],
    { stdio: "inherit" },
  );
  if (!fs.existsSync(out) || fs.statSync(out).size < 1000) {
    throw new Error(`Download failed or empty: ${out}`);
  }
  // Reject HTML quarantine pages misnamed as pdf
  const head = fs.readFileSync(out).subarray(0, 5).toString("utf-8");
  if (head.startsWith("%PDF") === false && head.startsWith("<!") === true) {
    throw new Error(`Got HTML instead of PDF for n=${v.n}`);
  }
  return out;
}

function extract(pdfPath: string, corpusDocId: string): string {
  const raw = execFileSync(
    "pdftotext",
    ["-enc", "UTF-8", "-nopgbrk", pdfPath, "-"],
    { encoding: "utf-8", maxBuffer: 400 * 1024 * 1024 },
  );
  let clean = stripPdfChrome(raw);
  clean = rejoinHyphenation(clean);
  clean = softNormalize(clean) + "\n";

  const rawOut = path.join(RAW_DIR, `${corpusDocId}.raw.txt`);
  const cleanOut = path.join(CLEAN_DIR, `${corpusDocId}.txt`);
  fs.writeFileSync(rawOut, raw, "utf-8");
  fs.writeFileSync(cleanOut, clean, "utf-8");
  console.log(
    `[✓] extract ${corpusDocId}: raw=${raw.length} clean=${clean.length}`,
  );
  if (clean.trim().length < 200) {
    throw new Error(
      `Near-empty text for ${corpusDocId} (scanned PDF? needs OCR)`,
    );
  }
  return cleanOut;
}

function titleFor(v: Volume): string {
  if (v.title) return v.title;
  return v.name
    .replace(/\.pdf$/i, "")
    .replace(/^\d+\s+/, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function importVolume(v: Volume, skipDownload: boolean): void {
  ensureDirs();
  const pdfPath = skipDownload
    ? path.join(PDF_DIR, pdfName(v))
    : download(v);
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Missing PDF: ${pdfPath}`);
  }
  const cleanPath = extract(pdfPath, v.corpusDocId);
  const text = fs.readFileSync(cleanPath, "utf-8");
  const units = plainTextToUnits(text, {
    mode: "paragraphs",
    minLength: 20,
    maxUnitLength: 2500,
    sequentialConsecutivo: true,
  });
  console.log(`[i] ${v.corpusDocId}: ${units.length} units`);
  if (units.length === 0) throw new Error("No units");

  const title = titleFor(v);
  const sourceUrl =
    v.sourceUrl ??
    `https://drive.google.com/file/d/${v.driveFileId}/view`;
  const config: SourceConfig = {
    id: `agustin-${v.n}`,
    title,
    shortTitle: title.length > 28 ? title.slice(0, 28) + "…" : title,
    kind: "patristic",
    locale: "es",
    corpusDocId: v.corpusDocId,
    adapter: "plain-text",
    seedUrls: [sourceUrl],
    author: v.author ?? "Agustín de Hipona",
    compiler: v.compiler ?? COMPILER,
    sourceNote:
      `Compilación digital del P. A. Cedano (sacerdote). ` +
      `Fuente Drive: ${sourceUrl}. Colección BAC Obras de San Agustín (tomo ${v.n}).`,
    notes: `Tomo BAC n=${v.n}: ${v.name}`,
  };
  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] corpus ${result.meta.id} units=${result.unitCount} terms=${result.termCount}`,
  );

  // update inventory status
  const inv = JSON.parse(fs.readFileSync(INV, "utf-8")) as AgustinInv;
  const entry = inv.volumes.find((x) => x.n === v.n);
  if (entry) {
    entry.status = "imported";
    entry.title = title;
    entry.author = config.author;
    entry.compiler = config.compiler;
    entry.sourceUrl = sourceUrl;
    fs.writeFileSync(INV, JSON.stringify(inv, null, 2) + "\n");
  }
}

function main(): void {
  const inv = JSON.parse(fs.readFileSync(INV, "utf-8")) as AgustinInv;
  let nums: number[] = [];
  if (hasFlag("--all-priority")) {
    nums = PRIORITY;
  } else if (arg("--n")) {
    nums = arg("--n")!
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  } else {
    console.error(
      "Usage: import_agustin_volume.ts --n 2|2,16,17 | --all-priority [--skip-download]",
    );
    process.exit(1);
  }

  const skipDownload = hasFlag("--skip-download");
  const errors: string[] = [];
  for (const n of nums) {
    const v = inv.volumes.find((x) => x.n === n);
    if (!v) {
      errors.push(`volume n=${n} not in inventory`);
      continue;
    }
    try {
      console.log(`\n======== Agustín n=${n} ${v.name} ========`);
      importVolume(v, skipDownload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[✗] n=${n}: ${msg}`);
      errors.push(`n=${n}: ${msg}`);
    }
  }
  if (errors.length) {
    console.error("\nFailures:\n" + errors.map((e) => " - " + e).join("\n"));
    process.exit(1);
  }
}

main();
