/**
 * Import Catecismus Romanus / Catecismo Romano into the offline corpus.
 *
 * Latin-first (OCR text from Archive.org DjVuTXT is OK):
 *   npx ts-node --transpile-only import_roman_catechism.ts --locale la \
 *     --file ../documentos/magisterium-source/raw/catecismo-romano-la-ocr.txt
 *   npx ts-node --transpile-only import_roman_catechism.ts --locale la --default-ocr
 *
 * Spanish twin (labeled dump: "1.1.1\\nbody\\n\\n1.1.2\\n…"):
 *   npx ts-node --transpile-only import_roman_catechism.ts --locale es \
 *     --file ../documentos/magisterium-source/clean/catecismo-romano-es.txt
 *
 * --clean-only: write cleaned Latin text to clean/ without corpus write.
 * --skip-write: parse only (print unit count + sample); does NOT clobber clean files.
 * --write-clean: allow rewriting magisterium-source/clean/* (default for --locale la).
 */
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import {
  cleanRomanCatechismOcr,
  isLabeledUnitDump,
  labeledUnitsToTransport,
  romanCatechismToUnits,
  transportToLabeledDump,
} from "./src/pipeline/roman_catechism_units";
import type { SourceConfig } from "./src/adapters/types";
import type { TrasnportData } from "./models/transport_data.model";

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

/** Refuse ES corpus write below this many units (prevents clobbering the twin). */
const MIN_ES_UNITS = 1000;
const MIN_LA_UNITS = 50;

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
  --clean-only     Write cleaned Latin text to magisterium-source/clean/ only
  --skip-write     Parse only (no corpus write; does not overwrite clean/)
  --write-clean    Rewrite clean/* from this run (default on for --locale la)
  --min-length N   Min unit body length for PARS parser (default 30; labeled ES uses 0)
  --force          Allow write even if unit count below safety threshold
`);
  process.exit(1);
}

function parseUnits(
  locale: string,
  raw: string,
  minLength: number,
): { units: TrasnportData[]; mode: string; textForClean: string } {
  // Prefer labeled dump whenever the file looks like consecutivo blocks
  // (Spanish twins, or any re-export of content.json).
  if (locale === "es" || isLabeledUnitDump(raw)) {
    const units = labeledUnitsToTransport(raw, { minLength: 0 });
    return {
      units,
      mode: "labeled-dump",
      textForClean: transportToLabeledDump(units),
    };
  }

  const cleaned = cleanRomanCatechismOcr(raw);
  const units = romanCatechismToUnits(cleaned, { minLength });
  return { units, mode: "pars-caput-ocr", textForClean: cleaned };
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
  const minLength = parseInt(arg("--min-length") ?? "30", 10) || 30;
  const { units, mode, textForClean } = parseUnits(locale, raw, minLength);

  console.log(`[i] parse mode: ${mode}`);
  console.log(`[+] units: ${units.length}`);
  if (units.length) {
    console.log(
      `[i] first: ${units[0].consecutivo} ${units[0].contenido.slice(0, 100)}…`,
    );
    console.log(
      `[i] last:  ${units[units.length - 1].consecutivo} ${units[units.length - 1].contenido.slice(0, 80)}…`,
    );
  }

  // Hierarchical ids must not be synthetic "uN" for ES regenerable path
  if (locale === "es" || mode === "labeled-dump") {
    const bogus = units.filter((u) => /^u\d+$/i.test(u.consecutivo)).length;
    if (bogus > 0) {
      console.error(
        `[!] ${bogus} synthetic uN ids — labeled dump parse failed; refuse write`,
      );
      if (!hasFlag("--force")) process.exit(2);
    }
  }

  const minSafe = locale === "es" ? MIN_ES_UNITS : MIN_LA_UNITS;
  if (units.length < minSafe) {
    console.error(
      `[!] Too few units (${units.length} < ${minSafe}); refuse write (use --force to override, --skip-write to inspect).`,
    );
    if (!hasFlag("--skip-write") && !hasFlag("--force")) process.exit(2);
  }

  const wantCleanWrite =
    hasFlag("--write-clean") ||
    hasFlag("--clean-only") ||
    (locale === "la" && mode === "pars-caput-ocr" && !hasFlag("--skip-write"));

  if (wantCleanWrite) {
    fs.mkdirSync(CLEAN_DIR, { recursive: true });
    const cleanOut = path.join(
      CLEAN_DIR,
      locale === "la" ? "catecismo-romano-la.txt" : "catecismo-romano-es.txt",
    );
    fs.writeFileSync(cleanOut, textForClean, "utf8");
    console.log(`[✓] cleaned → ${cleanOut} (${textForClean.length} chars)`);
  } else if (hasFlag("--skip-write")) {
    console.log("[i] skip-write: not rewriting clean/ files");
  }

  if (hasFlag("--clean-only")) {
    console.log("[i] clean-only; skip corpus write");
    return;
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
