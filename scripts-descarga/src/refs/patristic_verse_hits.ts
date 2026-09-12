/**
 * Capped patristic → bible verse harvest (sidecar only).
 *
 * Does not write content.json or unit-graph. Hits are a flat array grouped
 * by `${bookSlug}:${chapter}:${verse}` (max 8 per key, 4000 rows).
 */

import { extractCiteCandidateStrings, stripHtml } from "./harvest_inline";
import {
  parseRefGroup,
  SINGLE_CHAPTER_SLUGS,
  type BibleCitation,
  type BookCodeEntry,
  type BookIndex,
} from "./ref-parser";

export const PATRISTIC_VERSE_HITS_FILE = "patristic-verse-hits.json";

export const PATRISTIC_VERSE_HITS_CAPS = {
  maxPerVerse: 8,
  maxRows: 4000,
} as const;

export const DEFAULT_MAX_DOCS = 12;
export const MAX_SNIPPET = 140;

/** Patrologia / corpus series mistaken for bible books (OCR footnotes). */
const EDITION_SERIES_RE = /\b(?:PL|PG|CSEL|CCL|CChr|BAC)\.?\s*\d/i;

/** Cheap parenthetical "Book ch,verse" hint for ranking volumes. */
export const CITE_HINT_RE =
  /\((?:cf\.?\s*)?\d{0,1}\s*[A-Za-zÁÉÍÓÚáéíóúñÑ.]{1,16}[.,]?\s+\d{1,3}\s*[,:]\s*\d/i;

export interface PatristicVerseHit {
  bookSlug: string;
  chapter: number;
  verse: number;
  documentId: string;
  unitIndex: number;
  consecutivo: string;
  snippet: string;
}

export interface PatristicVerseHitsFile {
  version: 1;
  locale: string;
  generatedAt: string;
  caps: { maxPerVerse: number; maxRows: number };
  rowCount: number;
  documentsScanned: number;
  documentsListed?: number;
  maxDocs?: number | null;
  hits: PatristicVerseHit[];
}

export interface PatristicVerseHitCaps {
  maxPerVerse: number;
  maxRows: number;
}

export interface PatristicHarvestUnit {
  contenido?: string;
  consecutivo?: string | number;
  referencias?: Array<{ descripcion?: string }>;
}

export interface PatristicHarvestDoc {
  documentId: string;
  units: PatristicHarvestUnit[];
}

export interface HarvestStats {
  docsScanned: number;
  unitsScanned: number;
  candidates: number;
  parsed: number;
  droppedJunk: number;
  rawHits: number;
  verses: number;
  rows: number;
}

export interface ExtractStrictResult {
  citations: BibleCitation[];
  candidates: number;
  parsed: number;
  droppedJunk: number;
}

export function verseGroupKey(
  bookSlug: string,
  chapter: number,
  verse: number,
): string {
  return `${bookSlug}:${chapter}:${verse}`;
}

export function isPatristicSource(meta: {
  id?: string;
  kind?: string;
}): boolean {
  const kind = String(meta.kind || "");
  const id = String(meta.id || "");
  return kind === "patristic" || id.startsWith("agustin-");
}

export function isAllowedPatristicDocumentId(documentId: string): boolean {
  const id = String(documentId || "");
  if (!id) return false;
  if (id.startsWith("agustin-")) return true;
  // Other patristic packs in this corpus (kind=patristic in manifest).
  return /^(atanasio-|carta-diogneto-|cipriano-|cirilo-|clemente-|gregorio-)/.test(
    id,
  );
}

export function matchesLocale(
  meta: { id?: string; locale?: string },
  locale: string,
): boolean {
  const loc = String(meta.locale || "").toLowerCase();
  if (loc === locale) return true;
  return String(meta.id || "")
    .toLowerCase()
    .endsWith(`-${locale}`);
}

export function makeSnippet(
  text: string,
  focus?: string,
  max = MAX_SNIPPET,
): string {
  const plain = stripHtml(text).replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= max) return plain;
  const needle = String(focus || "").replace(/\s+/g, " ").trim();
  if (needle) {
    const i = plain.toLowerCase().indexOf(needle.toLowerCase());
    if (i >= 0) {
      const pad = Math.max(0, Math.floor((max - needle.length) / 2));
      let start = Math.max(0, i - pad);
      let end = Math.min(plain.length, start + max);
      if (end - start < max) start = Math.max(0, end - max);
      let s = plain.slice(start, end);
      if (start > 0) s = `…${s.slice(1)}`;
      if (end < plain.length) s = `${s.slice(0, -1)}…`;
      return s.slice(0, max);
    }
  }
  return `${plain.slice(0, max - 1)}…`;
}

export function versesForCitation(citation: BibleCitation): number[] {
  const out: number[] = [];
  const push = (n: number) => {
    if (!Number.isInteger(n) || n < 1) return;
    if (!out.includes(n)) out.push(n);
  };
  if (citation.verses && citation.verses.length) {
    for (const v of citation.verses) push(v);
  } else {
    push(citation.verseStart);
  }
  return out;
}

export function isEditionSeriesCite(raw: string): boolean {
  return EDITION_SERIES_RE.test(raw.trim());
}

/**
 * Drop OCR junk that parseBibleCitation may still accept
 * (leftover letters: Mi 6NE → fail parse; Mt 10,32x → verse 32 + leftover).
 */
export function isStrictBibleCitation(
  citation: BibleCitation,
  atom: string,
): boolean {
  if (citation.chapterOnly) return false;
  if (citation.verseStart < 1 && !citation.verseOnly) return false;
  if (citation.chapter > 151 || citation.verseStart > 200) return false;
  if (isEditionSeriesCite(atom)) return false;

  let rest = atom
    .trim()
    .replace(/^(?:cf\.?|véase|vease)\s+/i, "")
    .replace(/^también\s+/i, "")
    .trim();
  rest = rest
    .replace(/^\d{0,1}\s*[A-Za-zÁÉÍÓÚáéíóúÜüñÑ.]{1,20}\s+/u, "")
    .trim();
  if (/[A-Za-zÁÉÍÓÚÑ]/.test(rest)) return false;
  if (/\d{5,}/.test(rest)) return false;
  if (citation.verseOnly) {
    return /^\d{1,3}\s*\.?$/.test(rest);
  }
  return /^\d{1,3}\s*[,:]\s*\d/.test(rest);
}

function citationsFromAtoms(
  atoms: ReturnType<typeof parseRefGroup>,
  stats: { parsed: number; droppedJunk: number },
): BibleCitation[] {
  const citations: BibleCitation[] = [];
  for (const atom of atoms) {
    if (atom.kind !== "bible") continue;
    stats.parsed += 1;
    if (!isStrictBibleCitation(atom.citation, atom.raw)) {
      stats.droppedJunk += 1;
      continue;
    }
    citations.push(atom.citation);
  }
  return citations;
}

export function extractStrictBibleCitations(
  text: string,
  bookIndex: BookIndex,
): ExtractStrictResult {
  const citations: BibleCitation[] = [];
  const cands = extractCiteCandidateStrings(text);
  const stats = { parsed: 0, droppedJunk: 0 };

  for (const cand of cands) {
    if (isEditionSeriesCite(cand)) {
      stats.droppedJunk += 1;
      continue;
    }
    const atoms = parseRefGroup(cand, bookIndex);
    citations.push(...citationsFromAtoms(atoms, stats));
  }

  return {
    citations,
    candidates: cands.length,
    parsed: stats.parsed,
    droppedJunk: stats.droppedJunk,
  };
}

/** Parse a whole `referencias.descripcion` (often a bare "Mt 10,32"). */
export function extractStrictFromRawGroup(
  raw: string,
  bookIndex: BookIndex,
): ExtractStrictResult {
  const text = String(raw || "").trim();
  if (!text) {
    return { citations: [], candidates: 0, parsed: 0, droppedJunk: 0 };
  }
  if (isEditionSeriesCite(text)) {
    return { citations: [], candidates: 1, parsed: 0, droppedJunk: 1 };
  }
  const stats = { parsed: 0, droppedJunk: 0 };
  const atoms = parseRefGroup(text, bookIndex);
  const citations = citationsFromAtoms(atoms, stats);
  return {
    citations,
    candidates: 1,
    parsed: stats.parsed,
    droppedJunk: stats.droppedJunk,
  };
}

export function countUnitRefItems(units: PatristicHarvestUnit[]): number {
  let n = 0;
  for (const u of units) {
    const refs = Array.isArray(u?.referencias) ? u.referencias : [];
    n += refs.length;
  }
  return n;
}

export function countCiteHints(units: PatristicHarvestUnit[]): number {
  let n = 0;
  for (const u of units) {
    if (CITE_HINT_RE.test(String(u?.contenido || ""))) n += 1;
  }
  return n;
}

function emptyStats(): HarvestStats {
  return {
    docsScanned: 0,
    unitsScanned: 0,
    candidates: 0,
    parsed: 0,
    droppedJunk: 0,
    rawHits: 0,
    verses: 0,
    rows: 0,
  };
}

function pushHitsFromCitation(
  raw: PatristicVerseHit[],
  citation: BibleCitation,
  doc: PatristicHarvestDoc,
  unitIndex: number,
  consecutivo: string,
  snippetSource: string,
  perVerse: Map<string, number>,
  seen: Set<string>,
  caps: PatristicVerseHitCaps,
): boolean {
  const verses = versesForCitation(citation);
  for (const verse of verses) {
    if (raw.length >= caps.maxRows) return false;
    const vk = verseGroupKey(citation.bookSlug, citation.chapter, verse);
    const uk = `${vk}\t${doc.documentId}\t${unitIndex}`;
    if (seen.has(uk)) continue;
    const n = perVerse.get(vk) ?? 0;
    if (n >= caps.maxPerVerse) continue;
    seen.add(uk);
    perVerse.set(vk, n + 1);
    raw.push({
      bookSlug: citation.bookSlug,
      chapter: citation.chapter,
      verse,
      documentId: doc.documentId,
      unitIndex,
      consecutivo,
      snippet: makeSnippet(snippetSource, citation.raw),
    });
  }
  return raw.length < caps.maxRows;
}

export function collectPatristicVerseHits(
  docs: PatristicHarvestDoc[],
  bookIndex: BookIndex,
  caps: PatristicVerseHitCaps = PATRISTIC_VERSE_HITS_CAPS,
): { raw: PatristicVerseHit[]; stats: HarvestStats } {
  const stats = emptyStats();
  const raw: PatristicVerseHit[] = [];
  const perVerse = new Map<string, number>();
  const seen = new Set<string>();
  let room = true;

  outer: for (const doc of docs) {
    stats.docsScanned += 1;
    const units = Array.isArray(doc.units) ? doc.units : [];
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const contenido = String(u?.contenido || "");
      const consecutivo =
        u?.consecutivo != null && String(u.consecutivo) !== ""
          ? String(u.consecutivo)
          : String(i + 1);
      stats.unitsScanned += 1;

      if (contenido) {
        const extracted = extractStrictBibleCitations(contenido, bookIndex);
        stats.candidates += extracted.candidates;
        stats.parsed += extracted.parsed;
        stats.droppedJunk += extracted.droppedJunk;
        for (const citation of extracted.citations) {
          room = pushHitsFromCitation(
            raw,
            citation,
            doc,
            i,
            consecutivo,
            contenido,
            perVerse,
            seen,
            caps,
          );
          if (!room) break outer;
        }
      }

      const refs = Array.isArray(u?.referencias) ? u.referencias : [];
      for (const r of refs) {
        const desc = String(r?.descripcion || "").trim();
        if (!desc) continue;
        const extracted = extractStrictFromRawGroup(desc, bookIndex);
        stats.candidates += extracted.candidates;
        stats.parsed += extracted.parsed;
        stats.droppedJunk += extracted.droppedJunk;
        for (const citation of extracted.citations) {
          room = pushHitsFromCitation(
            raw,
            citation,
            doc,
            i,
            consecutivo,
            contenido || desc,
            perVerse,
            seen,
            caps,
          );
          if (!room) break outer;
        }
      }
    }
  }

  stats.rawHits = raw.length;
  return { raw, stats };
}

/**
 * Keep first 8 hits per verse key (scan order) and at most maxRows globally.
 * Dedupes the same documentId+unitIndex on the same verse.
 */
export function capPatristicHits(
  raw: PatristicVerseHit[],
  caps: PatristicVerseHitCaps = PATRISTIC_VERSE_HITS_CAPS,
): PatristicVerseHit[] {
  const maxPerVerse = Math.max(1, caps.maxPerVerse);
  const maxRows = Math.max(0, caps.maxRows);
  const perVerse = new Map<string, number>();
  const seen = new Set<string>();
  const kept: PatristicVerseHit[] = [];

  for (const h of raw) {
    if (kept.length >= maxRows) break;
    const vk = verseGroupKey(h.bookSlug, h.chapter, h.verse);
    const uk = `${vk}\t${h.documentId}\t${h.unitIndex}`;
    if (seen.has(uk)) continue;
    seen.add(uk);
    const n = perVerse.get(vk) ?? 0;
    if (n >= maxPerVerse) continue;
    perVerse.set(vk, n + 1);
    const snippet = String(h.snippet || "").slice(0, MAX_SNIPPET);
    kept.push({
      bookSlug: h.bookSlug,
      chapter: h.chapter,
      verse: h.verse,
      documentId: h.documentId,
      unitIndex: h.unitIndex,
      consecutivo: String(h.consecutivo ?? ""),
      snippet,
    });
  }
  return kept;
}

export function countHitRows(hits: PatristicVerseHit[]): number {
  return hits.length;
}

export function countVerseKeys(hits: PatristicVerseHit[]): number {
  const keys = new Set<string>();
  for (const h of hits) {
    keys.add(verseGroupKey(h.bookSlug, h.chapter, h.verse));
  }
  return keys.size;
}

export function buildPatristicVerseHitsFile(opts: {
  locale: string;
  hits: PatristicVerseHit[];
  documentsScanned: number;
  generatedAt?: string;
  caps?: PatristicVerseHitCaps;
  documentsListed?: number;
  maxDocs?: number | null;
}): PatristicVerseHitsFile {
  const caps = opts.caps ?? PATRISTIC_VERSE_HITS_CAPS;
  const hits = opts.hits;
  const file: PatristicVerseHitsFile = {
    version: 1,
    locale: opts.locale,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    caps: {
      maxPerVerse: caps.maxPerVerse,
      maxRows: caps.maxRows,
    },
    rowCount: hits.length,
    documentsScanned: opts.documentsScanned,
    hits,
  };
  if (opts.documentsListed != null) file.documentsListed = opts.documentsListed;
  if (opts.maxDocs !== undefined) file.maxDocs = opts.maxDocs;
  return file;
}

export function summarizePatristicVerseHitsFile(raw: unknown): {
  verses: number;
  rows: number;
} {
  const f = raw as Partial<PatristicVerseHitsFile> | null;
  const hits = f?.hits;
  if (Array.isArray(hits)) {
    return { verses: countVerseKeys(hits), rows: hits.length };
  }
  if (hits && typeof hits === "object") {
    let rows = 0;
    for (const list of Object.values(hits as Record<string, unknown>)) {
      if (Array.isArray(list)) rows += list.length;
    }
    return { verses: Object.keys(hits).length, rows };
  }
  return { verses: 0, rows: 0 };
}

export function validatePatristicVerseHitsFile(
  raw: unknown,
  locale: string,
  caps: PatristicVerseHitCaps = PATRISTIC_VERSE_HITS_CAPS,
): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return ["patristic-verse-hits: not an object"];
  }
  const f = raw as Partial<PatristicVerseHitsFile>;
  if (f.version !== 1) {
    errors.push(`patristic-verse-hits version ${f.version}, expected 1`);
  }
  if (f.locale && f.locale !== locale) {
    errors.push(
      `patristic-verse-hits locale ${f.locale} != expected ${locale}`,
    );
  }
  if (!Array.isArray(f.hits)) {
    errors.push("patristic-verse-hits.hits missing or not an array");
    return errors;
  }
  const declaredPer = f.caps?.maxPerVerse;
  const declaredRows = f.caps?.maxRows;
  if (typeof declaredPer === "number" && declaredPer > caps.maxPerVerse) {
    errors.push(
      `patristic-verse-hits caps.maxPerVerse ${declaredPer} > ${caps.maxPerVerse}`,
    );
  }
  if (typeof declaredRows === "number" && declaredRows > caps.maxRows) {
    errors.push(
      `patristic-verse-hits caps.maxRows ${declaredRows} > ${caps.maxRows}`,
    );
  }
  if (
    typeof f.rowCount === "number" &&
    f.rowCount !== f.hits.length
  ) {
    errors.push(
      `patristic-verse-hits rowCount ${f.rowCount} != hits.length ${f.hits.length}`,
    );
  }
  if (
    f.documentsScanned != null &&
    (typeof f.documentsScanned !== "number" ||
      !Number.isInteger(f.documentsScanned) ||
      f.documentsScanned < 0)
  ) {
    errors.push("patristic-verse-hits documentsScanned must be a non-negative int");
  }

  const perVerse = new Map<string, number>();
  for (let i = 0; i < f.hits.length; i++) {
    const h = f.hits[i];
    if (!h || typeof h !== "object") {
      errors.push(`patristic-verse-hits.hits[${i}] not object`);
      continue;
    }
    if (!h.bookSlug || typeof h.bookSlug !== "string") {
      errors.push(`patristic-verse-hits.hits[${i}] bad bookSlug`);
    }
    if (
      typeof h.chapter !== "number" ||
      !Number.isInteger(h.chapter) ||
      h.chapter < 0
    ) {
      errors.push(`patristic-verse-hits.hits[${i}] chapter must be non-negative int`);
    }
    if (
      typeof h.verse !== "number" ||
      !Number.isInteger(h.verse) ||
      h.verse < 1
    ) {
      errors.push(`patristic-verse-hits.hits[${i}] verse must be positive int`);
    }
    if (!h.documentId || typeof h.documentId !== "string") {
      errors.push(`patristic-verse-hits.hits[${i}] bad documentId`);
    }
    const ui = h.unitIndex;
    if (
      typeof ui !== "number" ||
      !Number.isInteger(ui) ||
      ui < 0 ||
      !Number.isFinite(ui)
    ) {
      errors.push(
        `patristic-verse-hits.hits[${i}] unitIndex must be non-negative int`,
      );
    }
    if (h.consecutivo != null && typeof h.consecutivo !== "string") {
      errors.push(`patristic-verse-hits.hits[${i}] consecutivo must be string`);
    }
    const snippet = h.snippet == null ? "" : String(h.snippet);
    if (snippet.length > MAX_SNIPPET) {
      errors.push(
        `patristic-verse-hits.hits[${i}] snippet length ${snippet.length} > ${MAX_SNIPPET}`,
      );
    }
    const vk = verseGroupKey(
      String(h.bookSlug || ""),
      Number(h.chapter),
      Number(h.verse),
    );
    perVerse.set(vk, (perVerse.get(vk) ?? 0) + 1);
  }
  for (const [key, n] of perVerse) {
    if (n > caps.maxPerVerse) {
      errors.push(
        `patristic-verse-hits verse ${key} length ${n} > ${caps.maxPerVerse}`,
      );
    }
  }
  if (f.hits.length > caps.maxRows) {
    errors.push(
      `patristic-verse-hits rows ${f.hits.length} > maxRows ${caps.maxRows}`,
    );
  }
  return errors;
}

/* --- optional bible verse-map helpers (not used by the sidecar writer) --- */

export const DEFAULT_BIBLE_ID_ES = "bible-pueblo-de-dios-es";

export function verseMapKey(
  slug: string,
  chapter: string | number,
  verse: string | number,
): string {
  return `${slug}|${String(chapter)}|${String(verse)}`;
}

export function slugsByBookCode(
  books: BookCodeEntry[],
): Map<string, string[]> {
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

export function buildBibleVerseMap(
  bible: Array<{
    biblia?: {
      libro?: string;
      capitulo?: string | number;
      versiculo?: number;
    };
  }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < bible.length; i++) {
    const b = bible[i]?.biblia;
    if (!b?.libro) continue;
    const key = verseMapKey(b.libro, b.capitulo ?? "", b.versiculo ?? 0);
    if (!map.has(key)) map.set(key, i);
  }
  return map;
}

export function lookupBibleUnitIndex(
  citation: BibleCitation,
  verseMap: Map<string, number>,
  codeSlugs: Map<string, string[]>,
): number | null {
  if (citation.chapterOnly) return null;
  const slugs =
    codeSlugs.get(citation.bookCode) ??
    [citation.bookSlug].filter(Boolean);

  const chaptersToTry: Array<string | number> = [citation.chapter];
  if (citation.chapter === 1 || citation.verseOnly) chaptersToTry.push(0);
  if (
    SINGLE_CHAPTER_SLUGS.has(citation.bookSlug) &&
    !chaptersToTry.includes(0)
  ) {
    chaptersToTry.push(0);
  }
  if (citation.verseOnly && citation.chapter === 0) chaptersToTry.push(1);

  const v = citation.verseStart;
  for (const slug of slugs) {
    for (const ch of chaptersToTry) {
      const idx = verseMap.get(verseMapKey(slug, ch, v));
      if (idx !== undefined) return idx;
    }
  }
  return null;
}
