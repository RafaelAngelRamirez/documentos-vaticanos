/**
 * Extract readable text from a local PDF or plain-text dump.
 * Respects the source tree layout used by padres-source and concilios-source:
 *   pdf/ → raw/ + clean/
 *
 * Policy:
 *   - If input is .txt: light clean → raw + clean
 *   - If PDF has a usable text layer (pdftotext): use it (no OCR)
 *   - If PDF is image-only: exit 2 with message to run ocr_volume.sh
 *
 *   npx ts-node --transpile-only extract_source_text.ts \
 *     --pdf ../documentos/concilios-source/pdf/nicea-i-la.pdf \
 *     --out-id nicea-i-la \
 *     --source-root concilios-source
 *
 *   npx ts-node --transpile-only extract_source_text.ts \
 *     --file ../documentos/concilios-source/raw/mansi-vol-5.raw.txt \
 *     --out-id nicea-i-la --source-root concilios-source
 */
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  rejoinHyphenation,
  softNormalize,
  stripPdfChrome,
} from "./src/pipeline/plain_text_units";

const REPO = path.resolve(__dirname, "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function resolveSourceRoot(name: string): string {
  if (path.isAbsolute(name)) return name;
  return path.join(REPO, "documentos", name);
}

function which(bin: string): string {
  return execFileSync("which", [bin], { encoding: "utf-8" }).trim();
}

/** Sample first pages; < minAlpha → treat as image PDF. */
function pdfTextLayerAlpha(pdfPath: string, maxPages = 3): number {
  try {
    const bin = which("pdftotext");
    const raw = execFileSync(
      bin,
      ["-f", "1", "-l", String(maxPages), "-enc", "UTF-8", pdfPath, "-"],
      { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 },
    );
    return [...raw].filter((c) => /\p{L}/u.test(c)).length;
  } catch {
    return 0;
  }
}

function extractPdfFull(pdfPath: string): string {
  const bin = which("pdftotext");
  return execFileSync(
    bin,
    ["-enc", "UTF-8", "-nopgbrk", pdfPath, "-"],
    { encoding: "utf-8", maxBuffer: 200 * 1024 * 1024 },
  );
}

function cleanText(raw: string): string {
  let t = stripPdfChrome(raw);
  t = rejoinHyphenation(t);
  t = softNormalize(t);
  return t + "\n";
}

function main(): void {
  const sourceRootName = arg("--source-root") ?? "padres-source";
  const sourceRoot = resolveSourceRoot(sourceRootName);
  const outId = arg("--out-id");
  const pdfArg = arg("--pdf");
  const fileArg = arg("--file");
  const forceOcr = hasFlag("--force-ocr");
  const minAlpha = parseInt(arg("--min-alpha") ?? "80", 10);

  if (!outId || (!pdfArg && !fileArg)) {
    console.error(`Usage:
  extract_source_text.ts --out-id <id> --source-root padres-source|concilios-source \\
    (--pdf <file.pdf> | --file <file.txt>) [--force-ocr] [--min-alpha 80]

  Image PDFs (weak text layer): exit 2 → run:
    ./ocr_volume.sh --pdf ... --doc-id <id> --source-root <root> --lang lat|spa_fast
`);
    process.exit(1);
  }

  const rawDir = path.join(sourceRoot, "raw");
  const cleanDir = path.join(sourceRoot, "clean");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(cleanDir, { recursive: true });

  let raw: string;
  let method: string;

  if (fileArg) {
    const p = path.isAbsolute(fileArg!)
      ? fileArg!
      : path.resolve(process.cwd(), fileArg!);
    if (!fs.existsSync(p)) {
      console.error(`File not found: ${p}`);
      process.exit(1);
    }
    raw = fs.readFileSync(p, "utf-8");
    method = "plain-text";
  } else {
    const pdfPath = path.isAbsolute(pdfArg!)
      ? pdfArg!
      : path.resolve(process.cwd(), pdfArg!);
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF not found: ${pdfPath}`);
      process.exit(1);
    }
    const alpha = pdfTextLayerAlpha(pdfPath);
    console.log(`[i] text-layer sample alpha=${alpha} (min=${minAlpha})`);
    if (forceOcr || alpha < minAlpha) {
      console.error(
        `[!] image PDF (or --force-ocr). Run OCR:\n` +
          `  ./ocr_volume.sh --pdf ${pdfPath} --doc-id ${outId} --source-root ${sourceRootName} --lang lat+eng --jobs 6`,
      );
      process.exit(2);
    }
    raw = extractPdfFull(pdfPath);
    method = "pdftotext";
  }

  const clean = cleanText(raw);
  const rawOut = path.join(rawDir, `${outId}.raw.txt`);
  const cleanOut = path.join(cleanDir, `${outId}.txt`);
  fs.writeFileSync(rawOut, raw, "utf-8");
  fs.writeFileSync(cleanOut, clean, "utf-8");

  console.log(
    `[✓] method=${method} raw=${raw.length} clean=${clean.length} → ${cleanOut}`,
  );

  // optional: shell out to OCR helper for convenience when --auto-ocr
  if (hasFlag("--auto-ocr") && method !== "pdftotext" && method !== "plain-text") {
    const pdfPath = path.isAbsolute(pdfArg!)
      ? pdfArg!
      : path.resolve(process.cwd(), pdfArg!);
    const script = path.join(__dirname, "ocr_volume.sh");
    const lang =
      sourceRootName.includes("concilio") ? "lat+eng" : "spa_fast";
    console.log(`[i] auto-ocr ${pdfPath}`);
    const r = spawnSync(
      "bash",
      [
        script,
        "--pdf",
        pdfPath,
        "--doc-id",
        outId!,
        "--source-root",
        sourceRootName,
        "--lang",
        lang,
        "--jobs",
        arg("--jobs") ?? "6",
      ],
      { stdio: "inherit" },
    );
    process.exit(r.status ?? 1);
  }
}

main();
