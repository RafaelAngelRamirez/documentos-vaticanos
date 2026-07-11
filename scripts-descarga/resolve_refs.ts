/**
 * Offline script: resolve CCC biblical footnotes to local bible corpus units.
 *
 * Usage: npx ts-node --transpile-only resolve_refs.ts
 *    or: npm run resolve:refs
 */
import fs from "fs";
import path from "path";
import bookCodes from "./models/data/book-codes.json";
import {
  BookCodeEntry,
  buildBookIndex,
  parseRefGroup,
  ParsedAtom,
  BibleCitation,
  SINGLE_CHAPTER_SLUGS,
} from "./src/refs/ref-parser";

const ROOT = path.resolve(__dirname);
const REPO = path.resolve(ROOT, "..");

const BIBLE_ID = "bible-pueblo-de-dios-es";
const BIBLE_CONTENT = path.join(
  REPO,
  "documentos/corpus/documents/bible-pueblo-de-dios-es/content.json",
);
const CIC_PATHS = [
  path.join(REPO, "documentos/corpus/documents/cic-es/content.json"),
  path.join(REPO, "frontend/src/assets/corpus/documents/cic-es/content.json"),
];

interface BibliaMeta {
  consecutivo_versiculo: string;
  versiculo: number;
  capitulo: string;
  libro: string;
  index_general: string;
}

interface TransportUnit {
  consecutivo: string;
  contenido: string;
  referencias?: Reference[];
  biblia?: BibliaMeta;
  index_array?: number;
}

interface Reference {
  descripcion: string;
  url?: string;
  local?: { idDocumento: string; idPunto: string };
  resolvedAtoms?: Array<{
    raw: string;
    kind: string;
    bookSlug?: string;
    chapter?: number;
    verse?: number;
    idPunto?: string;
  }>;
}

function verseKey(slug: string, chapter: string | number, verse: string | number): string {
  return `${slug}|${String(chapter)}|${String(verse)}`;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function buildVerseMap(bible: TransportUnit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < bible.length; i++) {
    const b = bible[i]?.biblia;
    if (!b) continue;
    const key = verseKey(b.libro, b.capitulo, b.versiculo);
    // Keep first occurrence for duplicates
    if (!map.has(key)) map.set(key, i);
  }
  return map;
}

/** Map bookCode → all slugs (primary first) for fallback to Greek supplements. */
function slugsByCode(books: BookCodeEntry[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const sorted = [...books].sort((a, b) => {
    const aSup = /suplementos/.test(a.bookSlug) ? 1 : 0;
    const bSup = /suplementos/.test(b.bookSlug) ? 1 : 0;
    return aSup - bSup;
  });
  for (const b of sorted) {
    const list = m.get(b.bookCode) ?? [];
    if (!list.includes(b.bookSlug)) list.push(b.bookSlug);
    m.set(b.bookCode, list);
  }
  return m;
}

function lookupVerse(
  citation: BibleCitation,
  verseMap: Map<string, number>,
  codeSlugs: Map<string, string[]>,
): number | null {
  const slugs =
    codeSlugs.get(citation.bookCode) ??
    [citation.bookSlug].filter(Boolean);

  const chaptersToTry: Array<string | number> = [citation.chapter];
  // Corpus stores some single-chapter books as capitulo "0"
  if (citation.chapter === 1 || citation.verseOnly) {
    chaptersToTry.push(0);
  }
  if (SINGLE_CHAPTER_SLUGS.has(citation.bookSlug) && !chaptersToTry.includes(0)) {
    chaptersToTry.push(0);
  }
  // Also try chapter as given when verseOnly used chapter 0
  if (citation.verseOnly && citation.chapter === 0) {
    chaptersToTry.push(1);
  }

  const versesToTry = [citation.verseStart];
  if (citation.verses) {
    for (const v of citation.verses) {
      if (!versesToTry.includes(v)) versesToTry.push(v);
    }
  }

  for (const slug of slugs) {
    for (const ch of chaptersToTry) {
      for (const v of versesToTry) {
        const idx = verseMap.get(verseKey(slug, ch, v));
        if (idx !== undefined) return idx;
      }
      // Chapter-only: accept any first verse found in chapter
      if (citation.chapterOnly) {
        for (const [k, idx] of verseMap) {
          if (k.startsWith(`${slug}|${ch}|`)) return idx;
        }
      }
    }
  }
  return null;
}

function resolveCicContent(
  units: TransportUnit[],
  verseMap: Map<string, number>,
  bookIndex: ReturnType<typeof buildBookIndex>,
  codeSlugs: Map<string, string[]>,
) {
  let totalRefs = 0;
  let resolved = 0;
  let unresolved = 0;
  let noise = 0;
  let bibleAtoms = 0;
  let noiseAtoms = 0;
  let unresolvedAtoms = 0;
  const samples: Array<{ descripcion: string; local: Reference["local"] }> = [];
  const unresolvedSamples: string[] = [];

  for (const unit of units) {
    if (!unit.referencias?.length) continue;

    for (const ref of unit.referencias) {
      totalRefs++;
      const atoms: ParsedAtom[] = parseRefGroup(ref.descripcion ?? "", bookIndex);

      let primaryIndex: number | null = null;
      const resolvedAtoms: NonNullable<Reference["resolvedAtoms"]> = [];

      for (const atom of atoms) {
        if (atom.kind === "noise") {
          noiseAtoms++;
          resolvedAtoms.push({ raw: atom.raw, kind: "noise" });
          continue;
        }
        if (atom.kind === "unresolved") {
          unresolvedAtoms++;
          resolvedAtoms.push({ raw: atom.raw, kind: "unresolved" });
          continue;
        }

        bibleAtoms++;
        const idx = lookupVerse(atom.citation, verseMap, codeSlugs);
        if (idx !== null) {
          if (primaryIndex === null) primaryIndex = idx;
          resolvedAtoms.push({
            raw: atom.raw,
            kind: "bible",
            bookSlug: atom.citation.bookSlug,
            chapter: atom.citation.chapter,
            verse: atom.citation.verseStart,
            idPunto: String(idx),
          });
        } else {
          unresolvedAtoms++;
          resolvedAtoms.push({
            raw: atom.raw,
            kind: "unresolved-bible",
            bookSlug: atom.citation.bookSlug,
            chapter: atom.citation.chapter,
            verse: atom.citation.verseStart,
          });
        }
      }

      const hasBible = atoms.some((a) => a.kind === "bible");
      const onlyNoise = atoms.length > 0 && atoms.every((a) => a.kind === "noise");

      if (primaryIndex !== null) {
        resolved++;
        ref.local = {
          idDocumento: BIBLE_ID,
          idPunto: String(primaryIndex),
        };
        ref.url = "";
        // Keep multi-cite detail without bloating every ref excessively
        if (resolvedAtoms.length > 1) {
          ref.resolvedAtoms = resolvedAtoms;
        } else {
          delete ref.resolvedAtoms;
        }
        if (samples.length < 12) {
          samples.push({ descripcion: ref.descripcion, local: ref.local });
        }
      } else if (onlyNoise || (!hasBible && atoms.every((a) => a.kind === "noise"))) {
        noise++;
        delete ref.local;
        delete ref.resolvedAtoms;
      } else {
        unresolved++;
        delete ref.local;
        delete ref.resolvedAtoms;
        if (unresolvedSamples.length < 15) {
          unresolvedSamples.push(ref.descripcion);
        }
      }
    }
  }

  return {
    totalRefs,
    resolved,
    unresolved,
    noise,
    bibleAtoms,
    noiseAtoms,
    unresolvedAtoms,
    samples,
    unresolvedSamples,
  };
}

/** Minimal inline asserts (also see ref_parser.test.ts). */
function runInlineAsserts(bookIndex: ReturnType<typeof buildBookIndex>): void {
  const cases: Array<[string, (a: ParsedAtom[]) => boolean]> = [
    [
      "Mt 10,32",
      (a) =>
        a.length === 1 &&
        a[0].kind === "bible" &&
        a[0].citation.bookSlug === "evangelio segun san mateo" &&
        a[0].citation.chapter === 10 &&
        a[0].citation.verseStart === 32,
    ],
    [
      "cf. Gn 1,26-28",
      (a) =>
        a[0].kind === "bible" &&
        a[0].citation.bookSlug === "genesis" &&
        a[0].citation.chapter === 1 &&
        a[0].citation.verseStart === 26 &&
        a[0].citation.verseEnd === 28 &&
        a[0].citation.cf === true,
    ],
    [
      "1Tm 2,3-4",
      (a) =>
        a[0].kind === "bible" &&
        a[0].citation.bookSlug === "primera carta a timoteo" &&
        a[0].citation.chapter === 2 &&
        a[0].citation.verseStart === 3,
    ],
    [
      "Rom 10,9",
      (a) =>
        a[0].kind === "bible" &&
        a[0].citation.bookSlug === "carta a los romanos" &&
        a[0].citation.chapter === 10 &&
        a[0].citation.verseStart === 9,
    ],
    ["1992", (a) => a.length === 1 && a[0].kind === "noise"],
    ["primera sección", (a) => a.length === 1 && a[0].kind === "noise"],
  ];

  for (const [input, check] of cases) {
    const parsed = parseRefGroup(input, bookIndex);
    if (!check(parsed)) {
      throw new Error(
        `Inline assert failed for ${JSON.stringify(input)} → ${JSON.stringify(parsed)}`,
      );
    }
  }
  console.log("Inline asserts: OK");
}

function main() {
  const books = bookCodes as BookCodeEntry[];
  const bookIndex = buildBookIndex(books);
  const codeSlugs = slugsByCode(books);

  runInlineAsserts(bookIndex);

  console.log(`Loading bible: ${BIBLE_CONTENT}`);
  const bible = loadJson<TransportUnit[]>(BIBLE_CONTENT);
  const verseMap = buildVerseMap(bible);
  console.log(`Bible units: ${bible.length}, verse keys: ${verseMap.size}`);
  console.log(`Book codes: ${books.length}, alias keys: ${bookIndex.size}`);

  // Resolve once from the first CIC path, then write to all.
  const primaryPath = CIC_PATHS[0];
  console.log(`Loading CIC: ${primaryPath}`);
  const cic = loadJson<TransportUnit[]>(primaryPath);

  const stats = resolveCicContent(cic, verseMap, bookIndex, codeSlugs);

  const payload = JSON.stringify(cic);
  for (const outPath of CIC_PATHS) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, "utf8");
    console.log(`Wrote ${outPath}`);
  }

  console.log("\n=== resolve_refs stats ===");
  console.log(
    JSON.stringify(
      {
        totalRefs: stats.totalRefs,
        resolved: stats.resolved,
        unresolved: stats.unresolved,
        noise: stats.noise,
        bibleAtoms: stats.bibleAtoms,
        noiseAtoms: stats.noiseAtoms,
        unresolvedAtoms: stats.unresolvedAtoms,
        resolveRate:
          stats.totalRefs > 0
            ? `${((100 * stats.resolved) / stats.totalRefs).toFixed(1)}%`
            : "n/a",
      },
      null,
      2,
    ),
  );
  console.log("\nSample resolved refs:");
  for (const s of stats.samples) {
    console.log(`  ${s.descripcion} → ${s.local?.idDocumento}#${s.local?.idPunto}`);
  }
  if (stats.unresolvedSamples.length) {
    console.log("\nSample unresolved:");
    for (const u of stats.unresolvedSamples) {
      console.log(`  ${u}`);
    }
  }
}

main();
