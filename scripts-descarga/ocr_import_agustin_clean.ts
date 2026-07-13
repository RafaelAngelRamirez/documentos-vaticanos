/**
 * Import an already-OCR'd clean text for an Agustín inventory volume.
 * Usage: npx ts-node --transpile-only ocr_import_agustin_clean.ts --n 12
 */
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
const CLEAN_DIR = path.join(SOURCE_ROOT, "clean");
const COMPILER = "A. Cedano";

interface Volume {
  n: number;
  driveFileId: string;
  name: string;
  corpusDocId: string;
  title?: string;
  author?: string;
  compiler?: string;
  sourceUrl?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
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

function main(): void {
  const n = parseInt(arg("--n") ?? "", 10);
  if (Number.isNaN(n)) {
    console.error("Usage: ocr_import_agustin_clean.ts --n <volume>");
    process.exit(1);
  }
  const inv = JSON.parse(fs.readFileSync(INV, "utf-8")) as { volumes: Volume[] };
  const v = inv.volumes.find((x) => x.n === n);
  if (!v) {
    console.error(`volume n=${n} not in inventory`);
    process.exit(1);
  }
  const cleanPath = path.join(CLEAN_DIR, `${v.corpusDocId}.txt`);
  if (!fs.existsSync(cleanPath)) {
    console.error(`Missing clean text: ${cleanPath}`);
    process.exit(1);
  }
  let text = fs.readFileSync(cleanPath, "utf-8");
  text = stripPdfChrome(text);
  text = rejoinHyphenation(text);
  text = softNormalize(text) + "\n";
  fs.writeFileSync(cleanPath, text, "utf-8");

  const units = plainTextToUnits(text, {
    mode: "paragraphs",
    minLength: 20,
    maxUnitLength: 2500,
    sequentialConsecutivo: true,
  });
  console.log(`[i] ${v.corpusDocId}: ${units.length} units from OCR clean`);
  if (units.length === 0) {
    console.error("No units");
    process.exit(1);
  }

  const title = titleFor(v);
  const sourceUrl =
    v.sourceUrl ?? `https://drive.google.com/file/d/${v.driveFileId}/view`;
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
      `Fuente Drive: ${sourceUrl}. Colección BAC Obras de San Agustín (tomo ${v.n}). ` +
      `Texto vía OCR (PDF escaneado).`,
    notes: `Tomo BAC n=${v.n}: ${v.name} (OCR)`,
  };
  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] corpus ${result.meta.id} units=${result.unitCount} terms=${result.termCount}`,
  );

  const entry = inv.volumes.find((x) => x.n === n);
  if (entry) {
    entry.title = title;
    entry.author = config.author;
    entry.compiler = config.compiler;
    entry.sourceUrl = sourceUrl;
    (entry as { status?: string }).status = "imported";
    fs.writeFileSync(INV, JSON.stringify(inv, null, 2) + "\n");
  }
}

main();
