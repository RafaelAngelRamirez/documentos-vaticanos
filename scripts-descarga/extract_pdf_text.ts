/**
 * Extract text from a local PDF via pdftotext (poppler) and write raw + cleaned files.
 *
 *   npx ts-node --transpile-only extract_pdf_text.ts \
 *     --pdf ../documentos/padres-source/pdf/carta-diogneto.pdf \
 *     --out-id carta-diogneto-es
 *
 * Or: --from-inventory carta-diogneto
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  rejoinHyphenation,
  softNormalize,
  stripPdfChrome,
} from "./src/pipeline/plain_text_units";

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "documentos/padres-source");
const INVENTORY = path.join(SOURCE_ROOT, "inventory/sources.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function whichPdftotext(): string {
  try {
    return execFileSync("which", ["pdftotext"], { encoding: "utf-8" }).trim();
  } catch {
    console.error("pdftotext not found (install poppler-utils)");
    process.exit(1);
  }
}

function extractPdf(pdfPath: string): string {
  const bin = whichPdftotext();
  // -layout keeps reading order reasonably; -enc UTF-8
  const raw = execFileSync(
    bin,
    ["-enc", "UTF-8", "-nopgbrk", pdfPath, "-"],
    { encoding: "utf-8", maxBuffer: 200 * 1024 * 1024 },
  );
  return raw;
}

function cleanText(raw: string): string {
  let t = stripPdfChrome(raw);
  t = rejoinHyphenation(t);
  t = softNormalize(t);
  return t + "\n";
}

function main(): void {
  let pdfPath: string | undefined;
  let outId: string | undefined;

  const fromInv = arg("--from-inventory");
  if (fromInv) {
    const inv = JSON.parse(fs.readFileSync(INVENTORY, "utf-8")) as {
      sources: Array<{
        id: string;
        corpusDocId?: string;
        pdfLocal?: string;
        rawLocal?: string;
        cleanLocal?: string;
      }>;
    };
    const src = inv.sources.find((s) => s.id === fromInv);
    if (!src?.pdfLocal || !src.corpusDocId) {
      console.error(`Inventory source ${fromInv} missing pdfLocal/corpusDocId`);
      process.exit(1);
    }
    pdfPath = path.join(SOURCE_ROOT, src.pdfLocal);
    outId = src.corpusDocId;
  } else {
    pdfPath = arg("--pdf");
    outId = arg("--out-id");
  }

  if (!pdfPath || !outId) {
    console.error(
      "Usage: extract_pdf_text.ts --pdf <file.pdf> --out-id <id> | --from-inventory <id>",
    );
    process.exit(1);
  }

  pdfPath = path.isAbsolute(pdfPath) ? pdfPath : path.resolve(process.cwd(), pdfPath);
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  console.log(`[i] extracting ${pdfPath}`);
  const raw = extractPdf(pdfPath);
  const clean = cleanText(raw);

  const rawDir = path.join(SOURCE_ROOT, "raw");
  const cleanDir = path.join(SOURCE_ROOT, "clean");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(cleanDir, { recursive: true });

  const rawOut = path.join(rawDir, `${outId}.raw.txt`);
  const cleanOut = path.join(cleanDir, `${outId}.txt`);
  fs.writeFileSync(rawOut, raw, "utf-8");
  fs.writeFileSync(cleanOut, clean, "utf-8");

  console.log(`[✓] raw   → ${rawOut} (${raw.length} chars)`);
  console.log(`[✓] clean → ${cleanOut} (${clean.length} chars)`);
}

main();
