/**
 * Harvest strict bible cites from patristic prose into a capped sidecar.
 * Does NOT rewrite content.json or unit-graph.json / doc-graph.json.
 *
 * Dual-writes:
 *   documentos/corpus/search/{locale}/patristic-verse-hits.json
 *   frontend/src/assets/corpus/search/{locale}/patristic-verse-hits.json
 *
 * Usage:
 *   npx ts-node --transpile-only build_patristic_verse_hits.ts --locale es
 *   npx ts-node --transpile-only build_patristic_verse_hits.ts --locale es --max-docs 12
 *   npm run topics:build-patristic -- --locale es
 */

import fs from "fs";
import path from "path";
import bookCodes from "./models/data/book-codes.json";
import {
  BookCodeEntry,
  buildBookIndex,
} from "./src/refs/ref-parser";
import {
  DEFAULT_MAX_DOCS,
  PATRISTIC_VERSE_HITS_CAPS,
  PATRISTIC_VERSE_HITS_FILE,
  buildPatristicVerseHitsFile,
  capPatristicHits,
  collectPatristicVerseHits,
  countCiteHints,
  countHitRows,
  countUnitRefItems,
  countVerseKeys,
  isPatristicSource,
  matchesLocale,
  type PatristicHarvestDoc,
  type PatristicHarvestUnit,
} from "./src/refs/patristic_verse_hits";

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
  unitCount?: number;
}

function parseArgs(argv: string[]) {
  let locale = "es";
  let dry = false;
  let maxDocs = DEFAULT_MAX_DOCS;
  const onlyIds: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--locale" && argv[i + 1]) locale = argv[++i];
    else if (a === "--dry-run") dry = true;
    else if (a === "--max-docs" && argv[i + 1]) {
      maxDocs = Math.max(0, parseInt(argv[++i], 10) || 0);
    } else if ((a === "--doc" || a === "--id") && argv[i + 1]) {
      onlyIds.push(argv[++i]);
    } else if (a === "--help") {
      console.log(
        "Usage: build_patristic_verse_hits.ts [--locale es] [--max-docs 12] [--doc id] [--dry-run]",
      );
      process.exit(0);
    }
  }
  return { locale, dry, maxDocs, onlyIds };
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

function hitsOutPath(root: string, locale: string): string {
  return path.join(root, "search", locale, PATRISTIC_VERSE_HITS_FILE);
}

function loadUnits(
  primary: string,
  meta: ManifestDoc,
): PatristicHarvestUnit[] | null {
  const bodyPath = resolveBody(primary, meta);
  if (!fs.existsSync(bodyPath)) {
    console.warn(`skip missing body ${meta.id}`);
    return null;
  }
  let units: unknown;
  try {
    units = JSON.parse(fs.readFileSync(bodyPath, "utf8"));
  } catch (e) {
    console.warn(`skip parse ${meta.id}`, e);
    return null;
  }
  if (!Array.isArray(units)) return null;
  return units as PatristicHarvestUnit[];
}

function rankAndSelect(
  listed: ManifestDoc[],
  primary: string,
  maxDocs: number,
  onlyIds: string[],
): {
  harvestDocs: PatristicHarvestDoc[];
  listedCount: number;
} {
  const cache = new Map<string, PatristicHarvestUnit[]>();
  const loadCached = (meta: ManifestDoc): PatristicHarvestUnit[] | null => {
    if (cache.has(meta.id)) return cache.get(meta.id) ?? null;
    const units = loadUnits(primary, meta);
    if (units) cache.set(meta.id, units);
    return units;
  };

  let picked: ManifestDoc[];
  if (onlyIds.length) {
    const want = new Set(onlyIds);
    picked = listed.filter((d) => want.has(d.id));
  } else {
    const scored = listed.map((meta) => {
      const units = loadCached(meta);
      const refCount = units ? countUnitRefItems(units) : -1;
      const citeHints = units ? countCiteHints(units) : -1;
      return {
        meta,
        refCount,
        citeHints,
        unitCount: units?.length ?? meta.unitCount ?? 0,
      };
    });

    scored.sort((a, b) => {
      if (b.refCount !== a.refCount) return b.refCount - a.refCount;
      if (b.citeHints !== a.citeHints) return b.citeHints - a.citeHints;
      if (b.unitCount !== a.unitCount) return b.unitCount - a.unitCount;
      return a.meta.id < b.meta.id ? -1 : a.meta.id > b.meta.id ? 1 : 0;
    });
    picked = (maxDocs > 0 ? scored.slice(0, maxDocs) : scored).map(
      (s) => s.meta,
    );
    const keep = new Set(picked.map((d) => d.id));
    for (const id of [...cache.keys()]) {
      if (!keep.has(id)) cache.delete(id);
    }
  }

  const harvestDocs: PatristicHarvestDoc[] = [];
  for (const meta of picked) {
    const units = loadCached(meta);
    if (!units) continue;
    harvestDocs.push({ documentId: meta.id, units });
    console.log(`scan ${meta.id}: ${units.length} units`);
  }
  return { harvestDocs, listedCount: listed.length };
}

function main() {
  const { locale, dry, maxDocs, onlyIds } = parseArgs(process.argv.slice(2));
  const primary = CORPUS_ROOTS[0];
  const manPath = path.join(primary, "manifest.json");
  if (!fs.existsSync(manPath)) {
    console.error(`Missing manifest ${manPath}`);
    process.exit(1);
  }
  const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
  const allDocs = (man.documents as ManifestDoc[]) || [];

  const listed = allDocs
    .filter((d) => isPatristicSource(d) && matchesLocale(d, locale))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const { harvestDocs, listedCount } = rankAndSelect(
    listed,
    primary,
    maxDocs,
    onlyIds,
  );

  const bookIndex = buildBookIndex(bookCodes as BookCodeEntry[]);

  const { raw, stats } = collectPatristicVerseHits(harvestDocs, bookIndex);
  const hits = capPatristicHits(raw, PATRISTIC_VERSE_HITS_CAPS);
  stats.verses = countVerseKeys(hits);
  stats.rows = countHitRows(hits);

  const payload = buildPatristicVerseHitsFile({
    locale,
    hits,
    documentsScanned: harvestDocs.length,
    documentsListed: listedCount,
    maxDocs: onlyIds.length ? null : maxDocs || null,
    caps: PATRISTIC_VERSE_HITS_CAPS,
  });
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  const written: string[] = [];
  if (!dry) {
    for (const root of CORPUS_ROOTS) {
      const out = hitsOutPath(root, locale);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, json, "utf8");
      written.push(path.relative(REPO, out));
      console.log(`wrote ${path.relative(REPO, out)} (${json.length} bytes)`);
    }
  }

  console.log(
    JSON.stringify(
      {
        locale,
        dry,
        maxDocs: onlyIds.length ? null : maxDocs || null,
        onlyIds: onlyIds.length ? onlyIds : undefined,
        documentsListed: listedCount,
        documentsScanned: harvestDocs.length,
        rowCount: payload.rowCount,
        verses: stats.verses,
        written: dry ? [] : written,
        ...stats,
        caps: PATRISTIC_VERSE_HITS_CAPS,
      },
      null,
      2,
    ),
  );
}

main();
