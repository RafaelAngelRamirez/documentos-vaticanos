/**
 * Import cleaned plain text into the offline corpus (meta + content + index).
 *
 * Usage:
 *   npx ts-node --transpile-only import_plain_text.ts \
 *     --id carta-diogneto-es \
 *     --title "Carta a Diogneto" \
 *     --short Diogneto \
 *     --kind patristic \
 *     --locale es \
 *     --file ../documentos/padres-source/clean/carta-diogneto-es.txt \
 *     --mode roman-chapters \
 *     --source-url "https://drive.google.com/..."
 *
 * Or from inventory:
 *   npx ts-node --transpile-only import_plain_text.ts --from-inventory carta-diogneto
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
const INVENTORY = path.join(
  REPO,
  "documentos/padres-source/inventory/sources.json",
);
const SOURCE_ROOT = path.join(REPO, "documentos/padres-source");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function usage(): never {
  console.error(`Usage:
  import_plain_text.ts --id <corpusDocId> --title "..." --file <path.txt> [options]
  import_plain_text.ts --from-inventory <sourceId>

Options:
  --short <shortTitle>     default: first word of title
  --kind <kind>            default: patristic
  --locale <locale>        default: es
  --mode paragraphs|roman-chapters|numbered-sections|lines
  --source-url <url>
  --min-length <n>         default: 20
  --skip-write             parse only (print unit count)
`);
  process.exit(1);
}

/** Compilador de la colección digital de Padres (carpeta Drive). */
const DEFAULT_COMPILER = "A. Cedano";
const DEFAULT_SOURCE_NOTE =
  "Compilación digital del P. A. Cedano (sacerdote). Extracción de texto desde la carpeta Google Drive «Padres de la Iglesia».";

interface InventorySource {
  id: string;
  corpusDocId: string;
  title: string;
  shortTitle: string;
  author?: string;
  driveFileId?: string;
  resourceKey?: string;
  cleanLocal?: string;
  rawLocal?: string;
  splitMode?: PlainSplitMode;
  notes?: string;
  status?: string;
  compiler?: string;
  sourceNote?: string;
  edition?: string;
}

interface InventoryFile {
  sources: InventorySource[];
  driveFolderUrl?: string;
  compiler?: string;
  sourceNote?: string;
}

function provenance(
  inv: InventoryFile,
  src: InventorySource,
): Pick<SourceConfig, "author" | "compiler" | "sourceNote" | "notes"> {
  const compiler = src.compiler ?? inv.compiler ?? DEFAULT_COMPILER;
  const edition = src.edition ? ` Edición/traducción de referencia: ${src.edition}.` : "";
  const baseNote =
    src.sourceNote ??
    inv.sourceNote ??
    DEFAULT_SOURCE_NOTE;
  const notes = [baseNote + edition, src.notes].filter(Boolean).join(" ");
  return {
    author: src.author,
    compiler,
    sourceNote: notes,
    notes,
  };
}

function loadFromInventory(sourceId: string): {
  config: SourceConfig;
  filePath: string;
  mode: PlainSplitMode;
  minLength: number;
} {
  const inv = JSON.parse(fs.readFileSync(INVENTORY, "utf-8")) as InventoryFile;
  const src = inv.sources.find((s) => s.id === sourceId);
  if (!src) {
    console.error(`Source not in inventory: ${sourceId}`);
    process.exit(1);
  }
  if (!src.corpusDocId || !src.cleanLocal) {
    console.error(`Source ${sourceId} missing corpusDocId/cleanLocal (volume pack?)`);
    process.exit(1);
  }
  const cleanPath = path.join(SOURCE_ROOT, src.cleanLocal);
  if (!fs.existsSync(cleanPath)) {
    // fall back to raw if clean not yet produced
    const rawPath = src.rawLocal
      ? path.join(SOURCE_ROOT, src.rawLocal)
      : null;
    if (rawPath && fs.existsSync(rawPath)) {
      console.warn(`[i] clean missing; using raw: ${rawPath}`);
      return {
        config: {
          id: src.id,
          title: src.title,
          shortTitle: src.shortTitle,
          kind: "patristic",
          locale: "es",
          corpusDocId: src.corpusDocId,
          adapter: "plain-text",
          seedUrls: src.driveFileId
            ? [
                `https://drive.google.com/file/d/${src.driveFileId}/view`,
              ]
            : inv.driveFolderUrl
              ? [inv.driveFolderUrl]
              : [],
          ...provenance(inv, src),
        },
        filePath: rawPath,
        mode: src.splitMode ?? "paragraphs",
        minLength: 20,
      };
    }
    console.error(`Missing clean text: ${cleanPath}`);
    process.exit(1);
  }
  return {
    config: {
      id: src.id,
      title: src.title,
      shortTitle: src.shortTitle,
      kind: "patristic",
      locale: "es",
      corpusDocId: src.corpusDocId,
      adapter: "plain-text",
      seedUrls: src.driveFileId
        ? [`https://drive.google.com/file/d/${src.driveFileId}/view`]
        : inv.driveFolderUrl
          ? [inv.driveFolderUrl]
          : [],
      ...provenance(inv, src),
    },
    filePath: cleanPath,
    mode: src.splitMode ?? "paragraphs",
    minLength: 20,
  };
}

function main(): void {
  const fromInv = arg("--from-inventory");
  let config: SourceConfig;
  let filePath: string;
  let mode: PlainSplitMode = "paragraphs";
  let minLength = 20;

  if (fromInv) {
    const loaded = loadFromInventory(fromInv);
    config = loaded.config;
    filePath = loaded.filePath;
    mode = loaded.mode;
    minLength = loaded.minLength;
  } else {
    const id = arg("--id");
    const title = arg("--title");
    const file = arg("--file");
    if (!id || !title || !file) usage();
    filePath = path.isAbsolute(file!)
      ? file!
      : path.resolve(process.cwd(), file!);
    mode = (arg("--mode") as PlainSplitMode) || "paragraphs";
    minLength = parseInt(arg("--min-length") ?? "20", 10);
    config = {
      id: id!,
      title: title!,
      shortTitle: arg("--short") ?? title!.split(/\s+/)[0],
      kind: arg("--kind") ?? "patristic",
      locale: arg("--locale") ?? "es",
      corpusDocId: id!,
      adapter: "plain-text",
      seedUrls: arg("--source-url") ? [arg("--source-url")!] : [],
      author: arg("--author"),
      compiler: arg("--compiler") ?? DEFAULT_COMPILER,
      sourceNote:
        arg("--source-note") ??
        DEFAULT_SOURCE_NOTE +
          (arg("--source-url")
            ? ` Fuente: ${arg("--source-url")}.`
            : ""),
    };
  }

  if (arg("--mode")) mode = arg("--mode") as PlainSplitMode;
  if (arg("--min-length")) minLength = parseInt(arg("--min-length")!, 10);
  if (arg("--source-url")) {
    config.seedUrls = [arg("--source-url")!];
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, "utf-8");
  const units = plainTextToUnits(text, {
    mode,
    minLength,
    sequentialConsecutivo: true,
  });

  console.log(
    `[i] ${config.corpusDocId}: ${units.length} units from ${path.basename(filePath)} (mode=${mode})`,
  );
  if (units.length > 0) {
    console.log(`[i] first: ${units[0].contenido.slice(0, 120).replace(/\n/g, " ")}…`);
    console.log(
      `[i] last:  ${units[units.length - 1].contenido.slice(0, 120).replace(/\n/g, " ")}…`,
    );
  }

  if (hasFlag("--skip-write")) {
    console.log("[i] --skip-write: not writing corpus");
    return;
  }

  if (units.length === 0) {
    console.error("No units produced; aborting write.");
    process.exit(1);
  }

  const result = writeCorpusDocument(config, units);
  console.log(
    `[✓] wrote ${result.unitCount} units, ${result.termCount} index terms → ${result.meta.id}`,
  );
}

main();
