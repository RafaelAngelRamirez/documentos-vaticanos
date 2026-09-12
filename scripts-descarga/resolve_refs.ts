/**
 * Offline multi-document reference resolver.
 *
 * For every corpus document that has `referencias[]`, parse each citation and
 * attach `local: { idDocumento, idPunto }` when the target exists in the pack:
 *   - biblical cites  → bible-pueblo-de-dios-es (verse map)
 *   - CIC / numbered  → cic-es (and any future numbered docs)
 *   - magisterial LG… → only when that doc is in the corpus (doc-codes corpusDocId)
 *
 * Works in any direction: CIC→Bible, Bible→CIC (when bible has refs), LG→CIC,
 * future docs among themselves. Re-run after adding documents to the corpus.
 *
 * Usage: npm run resolve:refs
 */
import fs from "fs";
import path from "path";
import bookCodes from "./models/data/book-codes.json";
import docCodesFile from "./models/data/doc-codes.json";
import {
  BookCodeEntry,
  DocCodeEntry,
  BibleCitation,
  EcclesialCitation,
  ParsedAtom,
  buildBookIndex,
  buildDocIndex,
  parseRefGroup,
  SINGLE_CHAPTER_SLUGS,
} from "./src/refs/ref-parser";
import { markResolvedMany } from "./src/pipeline/document_registry";

const ROOT = path.resolve(__dirname);
const REPO = path.resolve(ROOT, "..");
const CORPUS_ROOT = path.join(REPO, "documentos/corpus");
const ASSETS_ROOT = path.join(REPO, "frontend/src/assets/corpus");

const BIBLE_ID = "bible-pueblo-de-dios-es";
const CIC_ID = "cic-es";

interface DocumentMeta {
  id: string;
  title: string;
  shortTitle?: string;
  kind: string;
  locale?: string;
  bodyPath: string;
  indexPath: string;
  unitCount?: number;
}

interface CorpusManifest {
  version: string | number;
  documents: DocumentMeta[];
}

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
    code?: string;
    locator?: string | null;
    idDocumento?: string;
    idPunto?: string;
  }>;
}

interface LocalTarget {
  idDocumento: string;
  idPunto: string;
}

interface CorpusIndexes {
  /** bible: slug|ch|v → arrayIndex */
  verseMap: Map<string, number>;
  codeSlugs: Map<string, string[]>;
  /** docId → consecutivo/number string → arrayIndex (first match) */
  byNumber: Map<string, Map<string, number>>;
  /** loaded units by docId */
  units: Map<string, TransportUnit[]>;
  /** meta by id */
  meta: Map<string, DocumentMeta>;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function verseKey(
  slug: string,
  chapter: string | number,
  verse: string | number,
): string {
  return `${slug}|${String(chapter)}|${String(verse)}`;
}

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

function buildVerseMap(bible: TransportUnit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < bible.length; i++) {
    const b = bible[i]?.biblia;
    if (!b) continue;
    const key = verseKey(b.libro, b.capitulo, b.versiculo);
    if (!map.has(key)) map.set(key, i);
  }
  return map;
}

/** Map display numbers (consecutivo) → first array index. */
function buildNumberMap(units: TransportUnit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < units.length; i++) {
    const c = units[i]?.consecutivo;
    if (!c || c === "no-encontrado") continue;
    const key = String(c).trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, i);
  }
  return map;
}

function resolveCorpusPath(bodyPath: string, root: string): string {
  const cleaned = bodyPath.replace(/^\//, "");
  if (cleaned.startsWith("assets/")) {
    return path.join(REPO, "frontend/src", cleaned);
  }
  return path.join(root, cleaned);
}

function parseCliArgs(argv: string[]) {
  let locale = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--locale" && argv[i + 1]) locale = argv[++i];
  }
  return { locale };
}

function docMatchesLocale(doc: DocumentMeta, locale: string): boolean {
  if (!locale) return true;
  const loc = (doc.locale || "").toLowerCase();
  if (loc === locale) return true;
  if (String(doc.id).toLowerCase().endsWith(`-${locale}`)) return true;
  if (doc.kind === "bible") return true;
  return false;
}

function loadCorpusIndexes(
  manifest: CorpusManifest,
  books: BookCodeEntry[],
  locale = "",
): CorpusIndexes {
  const meta = new Map<string, DocumentMeta>();
  const units = new Map<string, TransportUnit[]>();
  const byNumber = new Map<string, Map<string, number>>();
  let verseMap = new Map<string, number>();
  const codeSlugs = slugsByCode(books);

  for (const doc of manifest.documents) {
    if (!docMatchesLocale(doc, locale)) continue;
    meta.set(doc.id, doc);
    const contentPath = resolveCorpusPath(doc.bodyPath, CORPUS_ROOT);
    if (!fs.existsSync(contentPath)) {
      console.warn(`[warn] missing content: ${contentPath}`);
      continue;
    }
    const list = loadJson<TransportUnit[]>(contentPath);
    units.set(doc.id, list);
    byNumber.set(doc.id, buildNumberMap(list));

    // Only the canonical Spanish Pueblo de Dios pack feeds verse lookup.
    // Other bible locales must not overwrite / empty the map.
    if (doc.id === BIBLE_ID) {
      verseMap = buildVerseMap(list);
    }
  }

  return { verseMap, codeSlugs, byNumber, units, meta };
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
  if (citation.chapter === 1 || citation.verseOnly) chaptersToTry.push(0);
  if (SINGLE_CHAPTER_SLUGS.has(citation.bookSlug) && !chaptersToTry.includes(0)) {
    chaptersToTry.push(0);
  }
  if (citation.verseOnly && citation.chapter === 0) chaptersToTry.push(1);

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
      if (citation.chapterOnly) {
        for (const [k, idx] of verseMap) {
          if (k.startsWith(`${slug}|${ch}|`)) return idx;
        }
      }
    }
  }
  return null;
}

function lookupNumbered(
  docId: string,
  locator: string | null,
  byNumber: Map<string, Map<string, number>>,
): number | null {
  if (!locator) return null;
  const map = byNumber.get(docId);
  if (!map) return null;
  const idx = map.get(String(locator));
  return idx === undefined ? null : idx;
}

function resolveAtom(
  atom: ParsedAtom,
  indexes: CorpusIndexes,
): LocalTarget | null {
  if (atom.kind === "bible") {
    const idx = lookupVerse(
      atom.citation,
      indexes.verseMap,
      indexes.codeSlugs,
    );
    if (idx === null) return null;
    return { idDocumento: BIBLE_ID, idPunto: String(idx) };
  }

  if (atom.kind === "ecclesial") {
    const c = atom.citation as EcclesialCitation;
    const docId = c.corpusDocId;
    if (!docId) return null; // known abbr but doc not in corpus yet
    if (!indexes.units.has(docId)) return null;
    if (c.locatorType === "bible") {
      // rare; treat as unresolved without verse
      return null;
    }
    const idx = lookupNumbered(docId, c.locator, indexes.byNumber);
    if (idx === null) return null;
    return { idDocumento: docId, idPunto: String(idx) };
  }

  return null;
}

function atomDetail(
  atom: ParsedAtom,
  target: LocalTarget | null,
): NonNullable<Reference["resolvedAtoms"]>[number] {
  if (atom.kind === "bible") {
    return {
      raw: atom.raw,
      kind: target ? "bible" : "unresolved-bible",
      bookSlug: atom.citation.bookSlug,
      chapter: atom.citation.chapter,
      verse: atom.citation.verseStart,
      idDocumento: target?.idDocumento,
      idPunto: target?.idPunto,
    };
  }
  if (atom.kind === "ecclesial") {
    return {
      raw: atom.raw,
      kind: target
        ? "ecclesial"
        : atom.citation.corpusDocId
          ? "missing-locator"
          : "pending-document",
      code: atom.citation.code,
      locator: atom.citation.locator,
      idDocumento: target?.idDocumento ?? atom.citation.corpusDocId ?? undefined,
      idPunto: target?.idPunto,
    };
  }
  return { raw: atom.raw, kind: atom.kind };
}

interface DocStats {
  docId: string;
  totalRefs: number;
  resolved: number;
  unresolved: number;
  noise: number;
  pendingDocument: number;
  samples: Array<{ from: string; descripcion: string; local: LocalTarget }>;
}

function resolveDocument(
  docId: string,
  units: TransportUnit[],
  indexes: CorpusIndexes,
  bookIndex: ReturnType<typeof buildBookIndex>,
  docIndex: ReturnType<typeof buildDocIndex>,
): DocStats {
  const stats: DocStats = {
    docId,
    totalRefs: 0,
    resolved: 0,
    unresolved: 0,
    noise: 0,
    pendingDocument: 0,
    samples: [],
  };

  const defaultNumbered =
    docId === CIC_ID
      ? {
          code: "CIC",
          corpusDocId: CIC_ID,
          title: "Catecismo de la Iglesia Católica",
        }
      : indexes.meta.get(docId)?.kind === "catechism" ||
          indexes.meta.get(docId)?.kind === "magisterium"
        ? {
            code: docId,
            corpusDocId: docId,
            title: indexes.meta.get(docId)?.title,
          }
        : undefined;

  for (const unit of units) {
    if (!unit.referencias?.length) continue;

    for (const ref of unit.referencias) {
      stats.totalRefs++;
      const atoms = parseRefGroup(ref.descripcion ?? "", {
        bookIndex,
        docIndex,
        defaultNumberedDoc: defaultNumbered,
      });

      let primary: LocalTarget | null = null;
      const resolvedAtoms: NonNullable<Reference["resolvedAtoms"]> = [];
      let pendingDoc = false;

      for (const atom of atoms) {
        if (atom.kind === "noise") {
          resolvedAtoms.push(atomDetail(atom, null));
          continue;
        }
        if (
          atom.kind === "ecclesial" &&
          !atom.citation.corpusDocId
        ) {
          pendingDoc = true;
          resolvedAtoms.push(atomDetail(atom, null));
          continue;
        }

        const target = resolveAtom(atom, indexes);
        if (target && !primary) primary = target;
        resolvedAtoms.push(atomDetail(atom, target));
      }

      const onlyNoise =
        atoms.length > 0 && atoms.every((a) => a.kind === "noise");

      if (primary) {
        stats.resolved++;
        ref.local = primary;
        ref.url = "";
        if (resolvedAtoms.length > 1) ref.resolvedAtoms = resolvedAtoms;
        else delete ref.resolvedAtoms;
        if (stats.samples.length < 8) {
          stats.samples.push({
            from: `${docId}:${unit.consecutivo}`,
            descripcion: ref.descripcion,
            local: primary,
          });
        }
      } else if (onlyNoise) {
        stats.noise++;
        delete ref.local;
        delete ref.resolvedAtoms;
      } else if (pendingDoc) {
        stats.pendingDocument++;
        delete ref.local;
        if (resolvedAtoms.length) ref.resolvedAtoms = resolvedAtoms;
      } else {
        stats.unresolved++;
        delete ref.local;
        delete ref.resolvedAtoms;
      }
    }
  }

  return stats;
}

function writeDocumentBoth(docId: string, bodyPath: string, units: TransportUnit[]) {
  const payload = JSON.stringify(units);
  const corpusPath = resolveCorpusPath(bodyPath, CORPUS_ROOT);
  const assetsPath = resolveCorpusPath(bodyPath, ASSETS_ROOT);
  for (const out of [corpusPath, assetsPath]) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, payload, "utf8");
    console.log(`  wrote ${out}`);
  }
  // Keep id stable
  void docId;
}

function main() {
  const { locale } = parseCliArgs(process.argv.slice(2));
  const books = bookCodes as BookCodeEntry[];
  const docEntries = (docCodesFile as { documents: DocCodeEntry[] }).documents;
  const bookIndex = buildBookIndex(books);
  const docIndex = buildDocIndex(docEntries);

  // Align doc-codes corpusDocId with manifest when present
  const manifestPath = path.join(CORPUS_ROOT, "manifest.json");
  const manifest = loadJson<CorpusManifest>(manifestPath);
  for (const entry of docEntries) {
    if (entry.corpusDocId && !manifest.documents.some((d) => d.id === entry.corpusDocId)) {
      // keep catalog but mark unavailable at resolve time via units map
    }
  }

  console.log(
    `Corpus docs: ${manifest.documents.map((d) => d.id).join(", ")}`,
  );
  console.log(
    `Book codes: ${books.length}, ecclesial codes: ${docEntries.length}`,
  );

  const indexes = loadCorpusIndexes(manifest, books, locale);
  if (locale) {
    console.log(`Locale filter: ${locale} (${indexes.meta.size} docs loaded)`);
  }
  console.log(
    `Bible verse keys: ${indexes.verseMap.size}; numbered maps: ${[
      ...indexes.byNumber.entries(),
    ]
      .map(([id, m]) => `${id}:${m.size}`)
      .join(", ")}`,
  );

  const allStats: DocStats[] = [];
  let totalResolved = 0;
  let totalRefs = 0;

  for (const doc of manifest.documents) {
    if (!docMatchesLocale(doc, locale)) continue;
    const units = indexes.units.get(doc.id);
    if (!units) continue;

    const hasRefs = units.some((u) => u.referencias && u.referencias.length > 0);
    if (!hasRefs) {
      console.log(`\n[skip] ${doc.id}: no referencias[]`);
      continue;
    }

    console.log(`\n[resolve] ${doc.id} (${units.length} units)`);
    const stats = resolveDocument(
      doc.id,
      units,
      indexes,
      bookIndex,
      docIndex,
    );
    allStats.push(stats);
    totalResolved += stats.resolved;
    totalRefs += stats.totalRefs;
    writeDocumentBoth(doc.id, doc.bodyPath, units);

    console.log(
      JSON.stringify(
        {
          totalRefs: stats.totalRefs,
          resolved: stats.resolved,
          unresolved: stats.unresolved,
          noise: stats.noise,
          pendingDocument: stats.pendingDocument,
          rate:
            stats.totalRefs > 0
              ? `${((100 * stats.resolved) / stats.totalRefs).toFixed(1)}%`
              : "n/a",
        },
        null,
        2,
      ),
    );
    for (const s of stats.samples) {
      console.log(
        `  ${s.from} | ${s.descripcion} → ${s.local.idDocumento}#${s.local.idPunto}`,
      );
    }
  }

  // pending report for docs cited but not in corpus
  const pendingPath = path.join(CORPUS_ROOT, "pending-documents.json");
  const pendingCodes = docEntries
    .filter((d) => !d.corpusDocId)
    .map((d) => ({
      code: d.code,
      title: d.title,
      kind: d.kind,
      note: "Not in corpus yet; refs stay unresolved until scraped and corpusDocId is set",
    }));
  fs.writeFileSync(
    pendingPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        pending: pendingCodes,
        corpusDocumentIds: manifest.documents.map((d) => d.id),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nWrote ${pendingPath}`);

  // Registry: mark every corpus doc we processed (had refs and was written)
  const resolvedIds = allStats.map((s) => s.docId);
  // Also mark docs present in corpus even if skipped (no refs) as "seen" only
  // when they were processed with refs — user asked markResolved for docs processed.
  if (resolvedIds.length) {
    try {
      markResolvedMany(resolvedIds);
    } catch (err) {
      console.warn(
        `[warn] document registry markResolved failed:`,
        (err as Error).message,
      );
    }
  }

  console.log("\n=== multi-document resolve summary ===");
  console.log(
    JSON.stringify(
      {
        documentsProcessed: allStats.length,
        totalRefs,
        totalResolved,
        overallRate:
          totalRefs > 0
            ? `${((100 * totalResolved) / totalRefs).toFixed(1)}%`
            : "n/a",
      },
      null,
      2,
    ),
  );
}

main();
