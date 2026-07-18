/**
 * Import Catecismus Romanus / Catecismo Romano into the offline corpus.
 *
 * Latin-first (OCR text from Archive.org DjVuTXT is OK):
 *   npx ts-node --transpile-only import_roman_catechism.ts --locale la \
 *     --file ../documentos/magisterium-source/raw/catecismo-romano-la-ocr.txt
 *
 * Spanish twin (pre-cleaned / translated plain text):
 *   npx ts-node --transpile-only import_roman_catechism.ts --locale es \
 *     --file ../documentos/magisterium-source/clean/catecismo-romano-es.txt
 *
 * --clean-only: write cleaned Latin text to clean/ without corpus write.
 * --skip-write: parse only (print unit count + sample).
 */
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import {
  cleanRomanCatechismOcr,
  romanCatechismToUnits,
} from "./src/pipeline/roman_catechism_units";
import type { SourceConfig } from "./src/adapters/types";

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "documentos", "magisterium-source");
const CLEAN_DIR = path.join(SOURCE_ROOT, "clean");
const RAW_DIR = path.join(SOURCE_ROOT, "raw");

const ARCHIVE_SOURCE =
  "https://archive.org/details/cathechismus_romanus_ad_parochos_ex_decreto_sacr_concilii_tridentini_1830";

const AI_NOTE_ES = (laId: string) =>
  `Traducción al español generada por IA a partir del texto latino del pack «Catechismus Romanus» (${laId}), limpio de OCR de dominio público (Archive.org). No es una traducción oficial de la Santa Sede ni una edición crítica. Destinada a estudio y lectura orientativa; en caso de duda, prevalece el texto latino.`;

const LA_NOTE =
  "Catechismus Romanus ad parochos (Trento / Pío V). Texto latino de dominio público a partir de OCR DjVuTXT de Archive.org (ed. s. XIX). Requiere limpieza mecánica de OCR; no es edición crítica. Fuente: " +
  ARCHIVE_SOURCE;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function usage(): never {
  console.error(`Usage:
  import_roman_catechism.ts --locale la|es --file <path.txt> [options]
  import_roman_catechism.ts --locale la --default-ocr

Options:
  --clean-only     Write cleaned text to magisterium-source/clean/ only
  --skip-write     Parse only (no corpus write)
  --min-length N   Min unit length (default 30)
`);
  process.exit(1);
}

function main(): void {
  const locale = (arg("--locale") ?? "la").toLowerCase();
  if (locale !== "la" && locale !== "es") usage();

  let filePath = arg("--file");
  if (hasFlag("--default-ocr") && !filePath) {
    filePath = path.join(RAW_DIR, "catecismo-romano-la-ocr.txt");
  }
  if (!filePath) usage();
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(abs, "utf8");
  const cleaned =
    locale === "la" || hasFlag("--force-clean")
      ? cleanRomanCatechismOcr(raw)
      : raw;

  fs.mkdirSync(CLEAN_DIR, { recursive: true });
  const cleanOut = path.join(
    CLEAN_DIR,
    locale === "la" ? "catecismo-romano-la.txt" : "catecismo-romano-es.txt",
  );
  fs.writeFileSync(cleanOut, cleaned, "utf8");
  console.log(`[✓] cleaned → ${cleanOut} (${cleaned.length} chars)`);

  if (hasFlag("--clean-only")) {
    console.log("[i] clean-only; skip units/corpus");
    return;
  }

  const minLength = parseInt(arg("--min-length") ?? "30", 10) || 30;
  const units = romanCatechismToUnits(cleaned, { minLength });
  console.log(`[+] units: ${units.length}`);
  if (units.length) {
    console.log(`[i] first: ${units[0].consecutivo} ${units[0].contenido.slice(0, 100)}…`);
    console.log(
      `[i] last:  ${units[units.length - 1].consecutivo} ${units[units.length - 1].contenido.slice(0, 80)}…`,
    );
  }

  if (units.length < 50) {
    console.error(
      `[!] Too few units (${units.length}); refuse write (use --skip-write to inspect).`,
    );
    if (!hasFlag("--skip-write") && !hasFlag("--force")) process.exit(2);
  }

  if (hasFlag("--skip-write")) {
    console.log("[i] skip-write");
    return;
  }

  const isLa = locale === "la";
  const config: SourceConfig = {
    id: isLa ? "catecismo-romano-la" : "catecismo-romano-es",
    title: isLa
      ? "Catechismus Romanus (ad parochos)"
      : "Catecismo Romano",
    shortTitle: isLa ? "CR" : "CR-ES",
    kind: "catechism",
    locale: isLa ? "la" : "es",
    corpusDocId: isLa ? "catecismo-romano-la" : "catecismo-romano-es",
    docCode: isLa ? "CR" : undefined,
    adapter: "plain_text",
    seedUrls: [ARCHIVE_SOURCE],
    sourceNote: isLa ? LA_NOTE : AI_NOTE_ES("catecismo-romano-la"),
    notes: isLa ? LA_NOTE : AI_NOTE_ES("catecismo-romano-la"),
  };

  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units (${result.termCount} index terms) → ${config.corpusDocId}`,
  );
}

main();
