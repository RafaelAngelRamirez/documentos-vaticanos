/**
 * Harvest citation windows from unit prose into referencias[] (hub kinds only).
 * Dual-writes corpus + assets. Does not rewrite contenido.
 *
 * Usage:
 *   npx ts-node --transpile-only harvest_inline_refs.ts --locale es
 */

import fs from "fs";
import path from "path";
import bookCodes from "./models/data/book-codes.json";
import docCodesFile from "./models/data/doc-codes.json";
import {
  BookCodeEntry,
  DocCodeEntry,
  buildBookIndex,
  buildDocIndex,
} from "./src/refs/ref-parser";
import {
  HARVEST_KINDS,
  harvestNewDescriptions,
} from "./src/refs/harvest_inline";

const REPO = path.resolve(__dirname, "..");
const CORPUS_ROOTS = [
  path.join(REPO, "documentos", "corpus"),
  path.join(REPO, "frontend", "src", "assets", "corpus"),
];

interface ManifestDoc {
  id: string;
  locale?: string;
  kind?: string;
  bodyPath?: string;
}

function parseArgs(argv: string[]) {
  let locale = "es";
  let dry = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--locale" && argv[i + 1]) locale = argv[++i];
    else if (a === "--dry-run") dry = true;
  }
  return { locale, dry };
}

function resolveBody(root: string, meta: ManifestDoc): string {
  if (meta.bodyPath) {
    const cleaned = meta.bodyPath.replace(/^\//, "");
    if (cleaned.startsWith("assets/corpus/")) {
      return path.join(root, cleaned.replace(/^assets\/corpus\//, ""));
    }
    return path.join(root, cleaned);
  }
  return path.join(root, "documents", meta.id, "content.json");
}

function main() {
  const { locale, dry } = parseArgs(process.argv.slice(2));
  const primary = CORPUS_ROOTS[0];
  const man = JSON.parse(
    fs.readFileSync(path.join(primary, "manifest.json"), "utf8"),
  );
  const docs = (man.documents as ManifestDoc[]).filter((d) => {
    const loc = (d.locale || "").toLowerCase();
    if (loc !== locale && !String(d.id).toLowerCase().endsWith(`-${locale}`)) {
      return false;
    }
    return HARVEST_KINDS.has(String(d.kind || ""));
  });

  const bookIndex = buildBookIndex(bookCodes as BookCodeEntry[]);
  const docIndex = buildDocIndex(
    (docCodesFile as { documents: DocCodeEntry[] }).documents,
  );

  let unitsTouched = 0;
  let refsAdded = 0;
  let docsTouched = 0;

  for (const meta of docs) {
    const bodyPath = resolveBody(primary, meta);
    if (!fs.existsSync(bodyPath)) continue;
    let units: Array<{
      contenido?: string;
      referencias?: Array<{ descripcion?: string }>;
    }>;
    try {
      units = JSON.parse(fs.readFileSync(bodyPath, "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(units)) continue;

    let changed = false;
    for (const u of units) {
      const existing = Array.isArray(u.referencias) ? u.referencias : [];
      const added = harvestNewDescriptions(
        String(u.contenido || ""),
        existing,
        bookIndex,
        docIndex,
      );
      if (!added.length) continue;
      u.referencias = [
        ...existing,
        ...added.map((descripcion) => ({ descripcion })),
      ];
      unitsTouched += 1;
      refsAdded += added.length;
      changed = true;
    }

    if (!changed) continue;
    docsTouched += 1;
    if (dry) continue;
    const payload = JSON.stringify(units);
    for (const root of CORPUS_ROOTS) {
      const out = resolveBody(root, meta);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, payload, "utf8");
    }
    console.log(`harvest ${meta.id}: +refs on ${units.filter((u) => u.referencias?.length).length} units`);
  }

  console.log(
    JSON.stringify(
      { locale, dry, docsScanned: docs.length, docsTouched, unitsTouched, refsAdded },
      null,
      2,
    ),
  );
}

main();
