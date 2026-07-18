/**
 * Import Spanish CCEO pack (cceo-es) aligned 1:1 with cceo-la.
 *
 * Source: labeled dump or content JSON produced by translate_cceo_es.py
 *
 *   npx ts-node --transpile-only import_cceo_es.ts
 *   npx ts-node --transpile-only import_cceo_es.ts --file ../documentos/magisterium-source/clean/cceo-es.txt
 *   npx ts-node --transpile-only import_cceo_es.ts --from-content
 *   npx ts-node --transpile-only import_cceo_es.ts --skip-write
 */
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import {
  isLabeledUnitDump,
  labeledUnitsToTransport,
} from "./src/pipeline/roman_catechism_units";
import type { SourceConfig } from "./src/adapters/types";
import type { TrasnportData } from "./models/transport_data.model";

const REPO = path.resolve(__dirname, "..");
const CLEAN_DIR = path.join(REPO, "documentos/magisterium-source/clean");
const LA_CONTENT = path.join(
  REPO,
  "documentos/corpus/documents/cceo-la/content.json",
);
const DEFAULT_LABELED = path.join(CLEAN_DIR, "cceo-es.txt");
const DEFAULT_CONTENT = path.join(CLEAN_DIR, "cceo-es.content.json");

const ES_ID = "cceo-es";
const LA_ID = "cceo-la";
const MIN_UNITS = 1400;

const AI_NOTE =
  "Traducción al español generada por IA a partir del texto latino del pack «Código de los Cánones de las Iglesias Orientales» (cceo-la) en vatican.va. No es una traducción oficial de la Santa Sede ni una edición crítica. Destinada a estudio y lectura orientativa; en caso de duda, prevalece el texto latino.";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadLaCount(): number {
  if (!fs.existsSync(LA_CONTENT)) return 0;
  const units = JSON.parse(fs.readFileSync(LA_CONTENT, "utf-8")) as unknown[];
  return Array.isArray(units) ? units.length : 0;
}

function loadUnits(): TrasnportData[] {
  if (hasFlag("--from-content") || (!hasFlag("--file") && fs.existsSync(DEFAULT_CONTENT))) {
    const p = arg("--file") && hasFlag("--from-content") ? arg("--file")! : DEFAULT_CONTENT;
    if (fs.existsSync(p) && p.endsWith(".json")) {
      const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as TrasnportData[];
      return raw.map((u) => ({
        consecutivo: String(u.consecutivo),
        contenido: (u.contenido || "").trim(),
        referencias: u.referencias || [],
      }));
    }
  }

  const filePath = arg("--file") ?? DEFAULT_LABELED;
  if (!fs.existsSync(filePath)) {
    console.error(`[!] missing ${filePath}`);
    console.error("Run: python3 translate_cceo_es.py");
    process.exit(1);
  }
  const text = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) {
    const raw = JSON.parse(text) as TrasnportData[];
    return raw.map((u) => ({
      consecutivo: String(u.consecutivo),
      contenido: (u.contenido || "").trim(),
      referencias: u.referencias || [],
    }));
  }
  if (!isLabeledUnitDump(text) && !text.trim().match(/^\d+\n/m)) {
    console.warn("[warn] file does not look like labeled dump; parsing anyway");
  }
  return labeledUnitsToTransport(text, { minLength: 0 }).filter(
    (u) => (u.contenido || "").trim().length > 0,
  );
}

function alignWithLa(es: TrasnportData[]): TrasnportData[] {
  if (!fs.existsSync(LA_CONTENT)) return es;
  const la = JSON.parse(fs.readFileSync(LA_CONTENT, "utf-8")) as TrasnportData[];
  if (es.length === la.length) {
    // Prefer LA consecutivo order exactly
    return la.map((lu, i) => ({
      consecutivo: String(lu.consecutivo),
      contenido: (es[i].contenido || "").trim(),
      referencias: es[i].referencias || [],
    }));
  }
  // Map by consecutivo if counts differ
  const byCon = new Map(es.map((u) => [String(u.consecutivo), u]));
  const aligned: TrasnportData[] = [];
  for (const lu of la) {
    const key = String(lu.consecutivo);
    const hit = byCon.get(key);
    if (!hit) {
      console.error(`[!] missing ES unit for consecutivo ${key}`);
      process.exitCode = 1;
      continue;
    }
    aligned.push({
      consecutivo: key,
      contenido: (hit.contenido || "").trim(),
      referencias: hit.referencias || [],
    });
  }
  return aligned;
}

function main(): void {
  const skipWrite = hasFlag("--skip-write");
  let units = loadUnits();
  units = alignWithLa(units);
  const laCount = loadLaCount();

  console.log(
    `[i] cceo-es: ${units.length} units (la=${laCount || "?"})`,
  );
  if (units.length < MIN_UNITS && !hasFlag("--force")) {
    console.error(
      `[!] unit count ${units.length} < ${MIN_UNITS}; use --force to write anyway`,
    );
    process.exit(1);
  }
  if (laCount && Math.abs(units.length - laCount) > 5) {
    console.error(
      `[!] unit count ES ${units.length} vs LA ${laCount} differs >5; abort`,
    );
    process.exit(1);
  }

  // Spot-check first unit Spanish
  const sample = (units[0]?.contenido || "").toLowerCase();
  if (
    sample.includes("[traducir]") ||
    (sample.includes("canones huius") && !sample.includes("cánones"))
  ) {
    console.error("[!] first unit still looks Latin/stub");
    process.exit(1);
  }

  if (skipWrite) {
    console.log("[i] --skip-write: sample unit 0:");
    console.log(units[0]?.contenido?.slice(0, 240));
    return;
  }

  const config: SourceConfig = {
    id: "cceo-es",
    title: "Código de los Cánones de las Iglesias Orientales",
    shortTitle: "CCEO",
    kind: "canon-law",
    locale: "es",
    corpusDocId: ES_ID,
    // Do NOT set docCode — keep cceo-la as citation target
    adapter: "plain-text",
    seedUrls: [
      "https://www.vatican.va/content/john-paul-ii/la/apost_constitutions/documents/hf_jp-ii_apc_19901018_index-codex-can-eccl-orient.html",
    ],
    sourceNote: AI_NOTE,
    notes: AI_NOTE,
  };

  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units → ${result.meta.id} (sourceNote: AI translation; la pack untouched)`,
  );

  // Assert LA still present
  const laMeta = path.join(
    REPO,
    "documentos/corpus/documents",
    LA_ID,
    "meta.json",
  );
  if (!fs.existsSync(laMeta)) {
    console.error(`[!] unexpected: ${LA_ID} missing after write`);
    process.exit(1);
  }
  console.log(`[✓] ${LA_ID} still present`);
}

main();
