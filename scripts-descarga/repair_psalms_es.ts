/**
 * Re-download Spanish Psalms (ESL0506) and splice complete verses into
 * bible-pueblo-de-dios-es. Does not invent text; does not hand-edit content.json.
 *
 * Usage (from scripts-descarga/):
 *   npx ts-node --transpile-only repair_psalms_es.ts
 *   npx ts-node --transpile-only repair_psalms_es.ts --dry-run
 *
 * ~1.2 MiB HTML from vatican.va (150 chapters + index). Same source already
 * packaged; Rafa authorized re-download of missing psalm lines (22-nov-2026).
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { parseHTML } from "linkedom";
import type { CorpusUnit } from "./models/transport_data.model";
import type { SourceConfig } from "./src/adapters/types";
import {
  parsePsalmChapterDocument,
  type ParsedVerse,
} from "./src/bible/psalm_verse_parse";
import {
  CANONICAL_CORPUS_ROOT,
  writeCorpusDocument,
  saveFixture,
} from "./src/pipeline/write_corpus";

const BIBLE_ID = "bible-pueblo-de-dios-es";
const INDEX_URL = "https://www.vatican.va/archive/ESL0506/_INDEX.HTM";
const BASE = "https://www.vatican.va/archive/ESL0506/";
const LIBRO = "salmos";
const ABR = "Sal";
const FIXTURE_DIR = path.join(__dirname, "fixtures", "psalms-es");

const dryRun = process.argv.includes("--dry-run");

interface ChapterLink {
  chapter: string;
  href: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url: string): Promise<{ html: string; bytes: number }> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: { "User-Agent": "documentos-vaticanos-repair-psalms/1.0" },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  const buf = Buffer.from(res.data);
  // ESL0506 pages are iso-8859-1
  const html = buf.toString("latin1");
  return { html, bytes: buf.length };
}

function extractPsalmLinks(indexHtml: string): ChapterLink[] {
  const m = indexHtml.match(/SALMOS<\/font><ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (!m) throw new Error("INDEX: SALMOS section not found");
  const links: ChapterLink[] = [];
  const re = /href=(__P[^>\s]+)\s*>(\d+)/gi;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(m[1]))) {
    links.push({ href: hit[1], chapter: hit[2] });
  }
  if (links.length !== 150) {
    throw new Error(`INDEX: expected 150 psalm links, got ${links.length}`);
  }
  return links;
}

function parseChapterHtml(html: string): ParsedVerse[] {
  const { document } = parseHTML(html);
  return parsePsalmChapterDocument(document);
}

function unitFromVerse(
  chapter: string,
  verse: ParsedVerse,
  indexGeneral: number,
): CorpusUnit {
  return {
    consecutivo: String(indexGeneral),
    contenido: verse.contenido,
    referencias: [],
    biblia: {
      consecutivo_versiculo: `${ABR} ${chapter}, ${verse.versiculo}`,
      versiculo: verse.versiculo,
      capitulo: chapter,
      libro: LIBRO,
      index_general: String(indexGeneral),
    },
    index_array: indexGeneral,
  };
}

function findSalmosRange(units: CorpusUnit[]): { first: number; last: number } {
  let first = -1;
  let last = -1;
  for (let i = 0; i < units.length; i++) {
    const libro = String(units[i].biblia?.libro ?? "").toLowerCase();
    if (libro === LIBRO) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0 || last < 0) {
    throw new Error("content.json: salmos block not found");
  }
  return { first, last };
}

function loadBibleSourceConfig(): SourceConfig {
  const sourcesPath = path.join(__dirname, "config", "sources.json");
  const file = JSON.parse(fs.readFileSync(sourcesPath, "utf8")) as {
    sources: SourceConfig[];
  };
  const cfg = file.sources.find((s) => s.corpusDocId === BIBLE_ID);
  if (!cfg) throw new Error(`sources.json missing ${BIBLE_ID}`);
  return cfg;
}

async function main(): Promise<void> {
  console.log(`[+] repair_psalms_es ${dryRun ? "(dry-run)" : ""}`);
  console.log(`[+] index ${INDEX_URL}`);

  const { html: indexHtml, bytes: indexBytes } = await fetchText(INDEX_URL);
  fs.mkdirSync(path.join(FIXTURE_DIR, "html"), { recursive: true });
  saveFixture(path.join(FIXTURE_DIR, "html", "_INDEX.HTM"), indexHtml);

  const links = extractPsalmLinks(indexHtml);
  const byChapter = new Map<string, ParsedVerse[]>();
  const counts: Record<string, number> = {};
  let totalBytes = indexBytes;

  for (let i = 0; i < links.length; i++) {
    const { chapter, href } = links[i];
    const url = BASE + href;
    const { html, bytes } = await fetchText(url);
    totalBytes += bytes;
    const verses = parseChapterHtml(html);
    if (verses.length === 0) {
      throw new Error(`Psalm ${chapter} (${href}): zero verses parsed`);
    }
    byChapter.set(chapter, verses);
    counts[chapter] = verses.length;

    // Keep HTML fixtures for the gate cases (22 = 16c trap, 23 = truncated pack).
    if (chapter === "22" || chapter === "23") {
      saveFixture(path.join(FIXTURE_DIR, "html", href), html);
    }

    if ((i + 1) % 25 === 0 || i === links.length - 1) {
      console.log(
        `[+] fetched ${i + 1}/${links.length} chapters (${Math.round(totalBytes / 1024)} KiB)`,
      );
    }
    await sleep(40);
  }

  const countsPath = path.join(FIXTURE_DIR, "expected_verse_counts.json");
  const countsPayload = {
    source: INDEX_URL,
    generatedAt: new Date().toISOString(),
    chapters: 150,
    totalVerses: Object.values(counts).reduce((a, b) => a + b, 0),
    downloadBytes: totalBytes,
    counts,
  };
  fs.writeFileSync(countsPath, JSON.stringify(countsPayload, null, 2) + "\n");
  console.log(`[✓] fixture counts → ${countsPath}`);
  console.log(
    JSON.stringify(
      {
        downloadKiB: Math.round(totalBytes / 1024),
        totalVerses: countsPayload.totalVerses,
        psalm23: counts["23"],
        psalm22: counts["22"],
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("[i] dry-run: corpus untouched");
    return;
  }

  const contentPath = path.join(
    CANONICAL_CORPUS_ROOT,
    "documents",
    BIBLE_ID,
    "content.json",
  );
  const units = JSON.parse(fs.readFileSync(contentPath, "utf8")) as CorpusUnit[];
  const { first, last } = findSalmosRange(units);
  const beforeCount = last - first + 1;

  const newSalmos: CorpusUnit[] = [];
  // provisional indices; renumber after splice
  for (let ch = 1; ch <= 150; ch++) {
    const key = String(ch);
    const verses = byChapter.get(key);
    if (!verses) throw new Error(`missing parsed chapter ${key}`);
    for (const v of verses) {
      newSalmos.push(unitFromVerse(key, v, 0));
    }
  }

  const next = [
    ...units.slice(0, first),
    ...newSalmos,
    ...units.slice(last + 1),
  ];
  for (let i = 0; i < next.length; i++) {
    const u = next[i];
    u.consecutivo = String(i);
    u.index_array = i;
    if (u.biblia) {
      u.biblia.index_general = String(i);
    }
  }

  console.log(
    `[+] salmos ${beforeCount} → ${newSalmos.length} (delta ${newSalmos.length - beforeCount}); total units ${units.length} → ${next.length}`,
  );

  // Spot-check Psalm 23 before write
  const p23 = newSalmos.filter((u) => String(u.biblia?.capitulo) === "23");
  const joined = p23.map((u) => u.contenido).join(" ").toLowerCase();
  if (!joined.includes("señor es mi pastor") || !joined.includes("nada me puede faltar")) {
    throw new Error("Psalm 23 repair missing expected source phrases");
  }

  const cfg = loadBibleSourceConfig();
  // Keep document meta free of adapter-stub notes from sources.json.
  delete cfg.notes;
  const result = writeCorpusDocument(cfg, next);
  console.log(
    JSON.stringify(
      {
        id: BIBLE_ID,
        unitCount: result.unitCount,
        contentHash: result.meta.contentHash,
        salmosVerses: newSalmos.length,
      },
      null,
      2,
    ),
  );

  // Keep legacy work-copy name used by migrate/reindex
  const legacyBody = path.join(__dirname, "documentos", "biblia_pueblo_de_Dios.json");
  const legacyIndex = path.join(
    __dirname,
    "documentos",
    "biblia_pueblo_de_Dios.index.json",
  );
  fs.writeFileSync(legacyBody, JSON.stringify(next));
  fs.writeFileSync(legacyIndex, JSON.stringify(result.index));
  console.log(`[✓] legacy work copy → ${legacyBody}`);

  // Patch original_structure salmos only (offline snapshot of chapter trees)
  const origPath = path.join(
    __dirname,
    "documentos",
    "biblia_pueblo_de_Dios.original_structure.json",
  );
  if (fs.existsSync(origPath)) {
    const orig = JSON.parse(fs.readFileSync(origPath, "utf8")) as Record<
      string,
      Record<string, Record<string, { versiculos: ParsedVerse[] }>>
    >;
    const at = orig["el antiguo testamento"];
    if (at?.salmos) {
      for (let ch = 1; ch <= 150; ch++) {
        const key = String(ch);
        at.salmos[key] = {
          versiculos: (byChapter.get(key) ?? []).map((v) => ({
            versiculo: v.versiculo,
            contenido: v.contenido,
          })),
        };
      }
      fs.writeFileSync(origPath, JSON.stringify(orig));
      console.log(`[✓] original_structure salmos patched → ${origPath}`);
    }
  }

  console.log("[✓] repair_psalms_es done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
