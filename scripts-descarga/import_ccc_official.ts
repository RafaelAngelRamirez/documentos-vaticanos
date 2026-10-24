/**
 * Import official CCC locale pack (not AI twin — independent unit layout).
 *
 * Prefer vatican.va ENG0015 scrape (scrape_ccc_eng0015.py) over MT.
 *
 *   python3 scrape_ccc_eng0015.py
 *   npx ts-node --transpile-only import_ccc_official.ts --locale en \
 *     --file ../documentos/magisterium-source/clean/cic-en.content.json
 *
 * Never overwrites cic-es. No docCode on non-ES packs (citas stay on ES).
 */
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import type { SourceConfig } from "./src/adapters/types";
import type { TrasnportData } from "./models/transport_data.model";

const REPO = path.resolve(__dirname, "..");
const CORPUS = path.join(REPO, "documentos/corpus");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

const OFFICIAL: Record<
  string,
  { title: string; shortTitle: string; sourceUrl: string; note: string }
> = {
  en: {
    title: "Catechism of the Catholic Church",
    shortTitle: "CCC",
    sourceUrl: "https://www.vatican.va/archive/ENG0015/_INDEX.HTM",
    note:
      "Official English edition from vatican.va (ENG0015 / Libreria Editrice Vaticana). " +
      "Sibling of cic-es; no docCode — stable citations remain on cic-es unitIndex/consecutivo.",
  },
  ar: {
    title: "التعليم المسيحي للكنيسة الكاثوليكية",
    shortTitle: "CCC",
    sourceUrl: "https://www.vatican.va/archive/catechism_ar/index_ar.htm",
    note:
      "Official Arabic edition from vatican.va (catechism_ar PDF / Libreria Editrice Vaticana). " +
      "Sibling of cic-es; no docCode — stable citations remain on cic-es unitIndex/consecutivo.",
  },
  zh: {
    title: "天主教教理",
    shortTitle: "CCC",
    sourceUrl: "https://www.vatican.va/chinese/ccc_zh.htm",
    note:
      "Official Traditional Chinese edition from vatican.va (chinese/ccc PDF / Libreria Editrice Vaticana). " +
      "Sibling of cic-es; no docCode — stable citations remain on cic-es unitIndex/consecutivo.",
  },
};

function main(): void {
  const locale = (arg("--locale") || "en").toLowerCase();
  const meta = OFFICIAL[locale];
  if (!meta) {
    console.error(
      `[!] locale ${locale} not in official map; known: ${Object.keys(OFFICIAL).join(", ")}`,
    );
    process.exit(1);
  }

  const defaultFile = path.join(
    REPO,
    "documentos/magisterium-source/clean",
    `cic-${locale}.content.json`,
  );
  const filePath = arg("--file") || defaultFile;
  if (!fs.existsSync(filePath)) {
    console.error(`[!] missing ${filePath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as TrasnportData[];
  const units: TrasnportData[] = raw.map((u) => ({
    consecutivo: String(u.consecutivo ?? ""),
    contenido: (u.contenido || "").trim(),
    referencias: u.referencias || [],
  })).filter((u) => u.contenido.length > 0);

  if (units.length < 100) {
    console.error(`[!] too few units (${units.length}); abort`);
    process.exit(1);
  }

  const corpusDocId = `cic-${locale}`;
  const esStill = path.join(CORPUS, "documents", "cic-es", "meta.json");
  if (!fs.existsSync(esStill)) {
    console.error("[!] cic-es missing — refuse to write without Spanish base");
    process.exit(1);
  }

  if (hasFlag("--skip-write")) {
    console.log(`[i] --skip-write units=${units.length}`);
    console.log(units.find((u) => /^\d+$/.test(u.consecutivo))?.contenido?.slice(0, 200));
    return;
  }

  const config: SourceConfig = {
    id: corpusDocId,
    title: meta.title,
    shortTitle: meta.shortTitle,
    kind: "catechism",
    locale,
    corpusDocId,
    // no docCode — citations stay on cic-es
    adapter: "plain-text",
    seedUrls: [meta.sourceUrl],
    sourceNote: meta.note,
    notes: meta.note,
    translationProvenance: "official",
  };

  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units → ${result.meta.id}` +
      ` (translationProvenance=official; no docCode)`,
  );
  console.log(`[✓] cic-es still present: ${fs.existsSync(esStill)}`);
}

main();
