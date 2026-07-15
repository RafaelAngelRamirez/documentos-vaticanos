/**
 * Import Spanish council packs (*-es) from clean/*-es.txt.
 * Pairs with Latin *-la; does not delete Latin packs.
 *
 *   npx ts-node --transpile-only import_council_es.ts --id nicea-i
 *   npx ts-node --transpile-only import_council_es.ts --all
 *   npx ts-node --transpile-only import_council_es.ts --list
 */
import fs from "fs";
import path from "path";
import { writeCorpusDocument } from "./src/pipeline/write_corpus";
import {
  plainTextToUnits,
  type PlainSplitMode,
} from "./src/pipeline/plain_text_units";
import type { SourceConfig } from "./src/adapters/types";

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "documentos/concilios-source");
const INVENTORY = path.join(SOURCE_ROOT, "inventory/councils.json");

const AI_NOTE = (titleLa: string, laId: string) =>
  `Traducción al español generada por IA a partir del texto latino del pack «${titleLa}» (${laId}). No es una traducción oficial de la Santa Sede ni una edición crítica. Destinada a estudio y lectura orientativa; en caso de duda, prevalece el texto latino.`;

/** Spanish display titles */
const TITLE_ES: Record<string, { title: string; shortTitle: string }> = {
  jerusalen: {
    title: "Concilio de Jerusalén",
    shortTitle: "Jerusalén",
  },
  "nicea-i": {
    title: "Concilio de Nicea I",
    shortTitle: "Nicea I",
  },
  "constantinopla-i": {
    title: "Concilio de Constantinopla I",
    shortTitle: "Constantinopla I",
  },
  efeso: { title: "Concilio de Éfeso", shortTitle: "Éfeso" },
  calcedonia: {
    title: "Concilio de Calcedonia",
    shortTitle: "Calcedonia",
  },
  "constantinopla-ii": {
    title: "Concilio de Constantinopla II",
    shortTitle: "Constantinopla II",
  },
  "constantinopla-iii": {
    title: "Concilio de Constantinopla III",
    shortTitle: "Constantinopla III",
  },
  "nicea-ii": {
    title: "Concilio de Nicea II",
    shortTitle: "Nicea II",
  },
  "constantinopla-iv": {
    title: "Concilio de Constantinopla IV",
    shortTitle: "Constantinopla IV",
  },
  "lateran-i": {
    title: "Concilio de Letrán I",
    shortTitle: "Letrán I",
  },
  "lateran-ii": {
    title: "Concilio de Letrán II",
    shortTitle: "Letrán II",
  },
  "lateran-iii": {
    title: "Concilio de Letrán III",
    shortTitle: "Letrán III",
  },
  "lateran-iv": {
    title: "Concilio de Letrán IV",
    shortTitle: "Letrán IV",
  },
  "lyon-i": { title: "Concilio de Lyon I", shortTitle: "Lyon I" },
  "lyon-ii": { title: "Concilio de Lyon II", shortTitle: "Lyon II" },
  vienne: { title: "Concilio de Vienne", shortTitle: "Vienne" },
  constanza: {
    title: "Concilio de Constanza",
    shortTitle: "Constanza",
  },
  florencia: {
    title: "Concilio de Basilea-Ferrara-Florencia",
    shortTitle: "Florencia",
  },
  "lateran-v": {
    title: "Concilio de Letrán V",
    shortTitle: "Letrán V",
  },
  trento: { title: "Concilio de Trento", shortTitle: "Trento" },
  "vat-i": {
    title: "Concilio Vaticano I",
    shortTitle: "Vaticano I",
  },
};

interface CouncilSource {
  id: string;
  corpusDocId: string | null;
  title: string;
  shortTitle: string;
  splitMode?: PlainSplitMode | null;
  seedUrls?: string[];
  status?: string;
  docCode?: string;
  existingCorpusDocIds?: string[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadInv(): { sources: CouncilSource[] } {
  return JSON.parse(fs.readFileSync(INVENTORY, "utf-8"));
}

function list(): void {
  const inv = loadInv();
  console.log(`${"id".padEnd(22)} es-clean  la-id`);
  for (const s of inv.sources) {
    if (s.status === "skipped-existing" || !s.corpusDocId) {
      console.log(`${s.id.padEnd(22)} (skip)   —`);
      continue;
    }
    const esId = s.corpusDocId.replace(/-la$/, "-es");
    const esClean = path.join(SOURCE_ROOT, "clean", `${esId}.txt`);
    const has = fs.existsSync(esClean);
    console.log(
      `${s.id.padEnd(22)} ${has ? "yes" : "NO "}     ${s.corpusDocId}`,
    );
  }
}

function importOne(src: CouncilSource, skipWrite: boolean): void {
  if (!src.corpusDocId || src.status === "skipped-existing") {
    console.log(`[i] skip ${src.id}`);
    return;
  }
  const laId = src.corpusDocId;
  const esId = laId.replace(/-la$/, "-es");
  const esClean = path.join(SOURCE_ROOT, "clean", `${esId}.txt`);
  if (!fs.existsSync(esClean)) {
    console.error(`[!] missing ${esClean} — translate first`);
    process.exitCode = 1;
    return;
  }

  const mode = (src.splitMode ?? "canons") as PlainSplitMode;
  const sequential =
    mode === "numbered-sections" ? false : mode === "canons" ? false : true;
  const text = fs.readFileSync(esClean, "utf-8");
  const units = plainTextToUnits(text, {
    mode,
    minLength: mode === "canons" ? 15 : 20,
    sequentialConsecutivo: sequential,
    maxUnitLength: mode === "canons" ? 0 : 2500,
  });

  const titles = TITLE_ES[src.id] ?? {
    title: src.title,
    shortTitle: src.shortTitle,
  };
  const note = AI_NOTE(src.title, laId);

  console.log(
    `[i] ${esId}: ${units.length} units from ${path.basename(esClean)} (mode=${mode})`,
  );
  if (skipWrite) return;
  if (units.length === 0) {
    console.error("No units");
    process.exitCode = 1;
    return;
  }

  const config: SourceConfig = {
    id: `${src.id}-es`,
    title: titles.title,
    shortTitle: titles.shortTitle,
    kind: "council",
    locale: "es",
    corpusDocId: esId,
    // Do NOT set docCode — keep Latin *-la as citation target in doc-codes.json
    adapter: "plain-text",
    seedUrls: src.seedUrls ?? [],
    sourceNote: note,
    notes: note,
  };

  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units → ${result.meta.id} (sourceNote: AI translation)`,
  );
}

function main(): void {
  const inv = loadInv();
  if (hasFlag("--list") || process.argv.length <= 2) {
    list();
    return;
  }
  const skipWrite = hasFlag("--skip-write");
  let ids: string[] = [];
  if (hasFlag("--all")) {
    ids = inv.sources
      .filter((s) => s.corpusDocId && s.status !== "skipped-existing")
      .map((s) => s.id);
  } else if (arg("--id")) {
    ids = [arg("--id")!];
  } else {
    list();
    process.exit(1);
  }

  for (const id of ids) {
    const src = inv.sources.find((s) => s.id === id);
    if (!src) {
      console.error(`Unknown ${id}`);
      process.exitCode = 1;
      continue;
    }
    importOne(src, skipWrite);
  }
}

main();
