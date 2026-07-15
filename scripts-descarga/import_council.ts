/**
 * Import a council clean text into the offline corpus (dual roots).
 *
 * Usage:
 *   npx ts-node --transpile-only import_council.ts --list
 *   npx ts-node --transpile-only import_council.ts --id nicea-i
 *   npx ts-node --transpile-only import_council.ts --id nicea-i --skip-write
 *   npx ts-node --transpile-only import_council.ts --all-ready
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

interface CouncilSource {
  id: string;
  order?: number;
  corpusDocId: string | null;
  title: string;
  shortTitle: string;
  years?: string;
  era?: string;
  splitMode?: PlainSplitMode | null;
  seedUrls?: string[];
  cleanLocal?: string;
  rawLocal?: string;
  status?: string;
  notes?: string;
  sourceNote?: string;
  docCode?: string;
  existingCorpusDocIds?: string[];
}

interface CouncilInventory {
  schemaVersion: number;
  kind?: string;
  locale?: string;
  sources: CouncilSource[];
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadInventory(): CouncilInventory {
  if (!fs.existsSync(INVENTORY)) {
    console.error(`Missing inventory: ${INVENTORY}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(INVENTORY, "utf-8")) as CouncilInventory;
}

function saveInventory(inv: CouncilInventory): void {
  fs.writeFileSync(INVENTORY, JSON.stringify(inv, null, 2) + "\n", "utf-8");
}

function listSources(inv: CouncilInventory): void {
  console.log(
    `${"id".padEnd(22)} ${"status".padEnd(18)} ${"corpusDocId".padEnd(28)} title`,
  );
  console.log("-".repeat(90));
  for (const s of inv.sources) {
    const docId = s.corpusDocId ?? (s.existingCorpusDocIds?.join(",") ?? "—");
    console.log(
      `${s.id.padEnd(22)} ${(s.status ?? "?").padEnd(18)} ${String(docId).slice(0, 28).padEnd(28)} ${s.shortTitle}`,
    );
  }
}

function resolveTextPath(src: CouncilSource): string {
  if (!src.cleanLocal) {
    console.error(`Source ${src.id} has no cleanLocal`);
    process.exit(1);
  }
  const cleanPath = path.join(SOURCE_ROOT, src.cleanLocal);
  if (fs.existsSync(cleanPath)) return cleanPath;
  if (src.rawLocal) {
    const rawPath = path.join(SOURCE_ROOT, src.rawLocal);
    if (fs.existsSync(rawPath)) {
      console.warn(`[i] clean missing; using raw: ${rawPath}`);
      return rawPath;
    }
  }
  console.error(`Missing clean text: ${cleanPath}`);
  process.exit(1);
}

function toConfig(src: CouncilSource, inv: CouncilInventory): SourceConfig {
  if (!src.corpusDocId) {
    console.error(
      `Source ${src.id} has no corpusDocId (status=${src.status}). Skip or use existing docs.`,
    );
    process.exit(1);
  }
  return {
    id: src.id,
    title: src.title,
    shortTitle: src.shortTitle,
    kind: inv.kind ?? "council",
    locale: inv.locale ?? "la",
    corpusDocId: src.corpusDocId,
    docCode: src.docCode,
    adapter: "plain-text",
    seedUrls: src.seedUrls ?? [],
    notes: src.notes,
    sourceNote: src.sourceNote,
  };
}

function importOne(
  src: CouncilSource,
  inv: CouncilInventory,
  options: { skipWrite: boolean },
): number {
  if (src.status === "skipped-existing") {
    console.log(
      `[i] ${src.id}: skipped-existing (${(src.existingCorpusDocIds ?? []).join(", ")})`,
    );
    return 0;
  }
  if (!src.corpusDocId) {
    console.warn(`[warn] ${src.id}: no corpusDocId`);
    return 0;
  }

  const filePath = resolveTextPath(src);
  const mode = (src.splitMode ?? "paragraphs") as PlainSplitMode;
  const text = fs.readFileSync(filePath, "utf-8");
  const sequential =
    mode === "numbered-sections" ? false : mode === "canons" ? false : true;
  const units = plainTextToUnits(text, {
    mode,
    minLength: mode === "canons" ? 15 : 20,
    sequentialConsecutivo: sequential,
    maxUnitLength: mode === "canons" ? 0 : 2500,
  });

  console.log(
    `[i] ${src.corpusDocId}: ${units.length} units from ${path.basename(filePath)} (mode=${mode})`,
  );
  if (units.length > 0) {
    console.log(
      `[i] first: ${units[0].contenido.slice(0, 100).replace(/\n/g, " ")}…`,
    );
  }

  if (options.skipWrite) {
    console.log("[i] --skip-write: not writing corpus");
    return units.length;
  }
  if (units.length === 0) {
    console.error("No units produced; aborting write.");
    process.exit(1);
  }

  const config = toConfig(src, inv);
  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units, ${result.termCount} index terms → ${result.meta.id}`,
  );

  src.status = "imported";
  return units.length;
}

function usage(): never {
  console.error(`Usage:
  import_council.ts --list
  import_council.ts --id <sourceId> [--skip-write]
  import_council.ts --all-ready [--skip-write]

  --all-ready  import every source with status clean|downloaded and a clean file
`);
  process.exit(1);
}

function main(): void {
  const inv = loadInventory();

  if (hasFlag("--list") || process.argv.length <= 2) {
    listSources(inv);
    if (!hasFlag("--list") && process.argv.length <= 2) {
      console.log("\n(use --list | --id <id> | --all-ready)");
    }
    return;
  }

  const skipWrite = hasFlag("--skip-write");
  let dirty = false;

  if (hasFlag("--all-ready")) {
    const ready = inv.sources.filter(
      (s) =>
        (s.status === "clean" || s.status === "downloaded") &&
        s.corpusDocId &&
        s.cleanLocal &&
        fs.existsSync(path.join(SOURCE_ROOT, s.cleanLocal)),
    );
    if (ready.length === 0) {
      console.log("[i] no ready sources (status clean/downloaded + clean file)");
      return;
    }
    for (const src of ready) {
      importOne(src, inv, { skipWrite });
      dirty = true;
    }
  } else {
    const id = arg("--id");
    if (!id) usage();
    const src = inv.sources.find((s) => s.id === id);
    if (!src) {
      console.error(`Unknown source id: ${id}`);
      process.exit(1);
    }
    importOne(src, inv, { skipWrite });
    dirty = true;
  }

  if (dirty && !skipWrite) {
    saveInventory(inv);
    console.log(`[✓] inventory updated → ${INVENTORY}`);
  }
}

main();
