/**
 * Patristic citations that can open the shared passage sheet.
 * Only a work already in the offline corpus, and only when one section,
 * chapter, or book/chapter/paragraph can be cut out of it. A BAC volume
 * whose paragraph cannot be isolated stays plain text: the sheet must not
 * open the whole book. Confessions and De Trinitate cut the NPNF paragraph.
 */

import {
  resolveCitedPassageFromUnitIndexes,
  type CitedPassage,
  type PassageUnitLike,
} from './resolve-cited-passage.logic';

export const ATHANASIUS_INCARNATION_ID = 'atanasio-de-incarnatione-en';
export const DIOGNETUS_ID = 'carta-diogneto-es';
export const AUGUSTINE_CONFESSIONS_ID = 'npnf-agustin-confesiones-en';
export const AUGUSTINE_TRINITY_ID = 'npnf-agustin-de-trinitate-en';

/** A passage longer than this is the book, not the cite. */
const MAX_PASSAGE_UNITS = 8;

const ROMAN_TO_N: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

const ROMAN_ALT =
  'XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I';

/** Books of Confessions (13) and De Trinitate (15). Longer first. */
const BOOK_ROMAN: Record<string, number> = {
  XV: 15,
  XIV: 14,
  XIII: 13,
  XII: 12,
  XI: 11,
  X: 10,
  IX: 9,
  VIII: 8,
  VII: 7,
  VI: 6,
  V: 5,
  IV: 4,
  III: 3,
  II: 2,
  I: 1,
};

const BOOK_ALT =
  'XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I|\\d{1,2}';

const WORK_ALT =
  'The\\s+Confessions|Confessiones|Confesiones|Confessions|On\\s+the\\s+Holy\\s+Trinity|De\\s+Trinitate';

export type PatristicLocate =
  | { kind: 'section'; section: number }
  | { kind: 'chapters'; chapters: number[] }
  | { kind: 'bookParagraph'; book: number; chapter: number; paragraph: number };

export interface PatristicCite {
  documentId: string;
  label: string;
  /** PG / PL tail. The sheet keeps it behind “Edición”. */
  editionNote: string | null;
  locate: PatristicLocate;
}

export interface PatristicSpan {
  start: number;
  end: number;
  label: string;
  cite: PatristicCite;
}

interface RawHit {
  start: number;
  end: number;
  label: string;
  documentId: string;
  editionNote: string | null;
  locate: PatristicLocate;
}

/**
 * One citation inside a paragraph. Two cites in the same string are two spans.
 * A name without a section or chapter is not a span.
 */
export function findPatristicSpans(text: string): PatristicSpan[] {
  const raw = text || '';
  if (!raw) return [];
  const hits: RawHit[] = [];
  collectIncarnation(raw, hits);
  collectDiognetus(raw, hits);
  collectAugustine(raw, hits);
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: RawHit[] = [];
  for (const hit of hits) {
    const last = kept[kept.length - 1];
    if (last && hit.start < last.end) continue;
    kept.push(hit);
  }
  return kept.map((hit) => ({
    start: hit.start,
    end: hit.end,
    label: hit.label,
    cite: {
      documentId: hit.documentId,
      label: hit.label,
      editionNote: hit.editionNote,
      locate: hit.locate,
    },
  }));
}

/** The segment label is one cite. A paragraph with two cites is not one label. */
export function parsePatristicCite(label: string): PatristicCite | null {
  const spans = findPatristicSpans(label || '');
  if (spans.length !== 1) return null;
  return spans[0].cite;
}

/**
 * The cited units only. Null when the section is missing, ambiguous,
 * or would be the whole document.
 */
export function citedPassageForPatristic(
  cite: PatristicCite | null | undefined,
  units: readonly PassageUnitLike[] | null | undefined,
): CitedPassage | null {
  if (!cite || !units?.length) return null;
  const indexes = locateUnits(units, cite.locate);
  if (!indexes?.length) return null;
  if (units.length > 1 && indexes.length >= units.length) return null;
  if (indexes.length > MAX_PASSAGE_UNITS) return null;
  return resolveCitedPassageFromUnitIndexes(
    cite.documentId,
    cite.label,
    units,
    indexes,
  );
}

function collectIncarnation(text: string, hits: RawHit[]): void {
  const re =
    /(?:San\s+)?Atanasio(?:\s+de\s+Alejandr[ií]a)?\s*,\s*De\s+Incarnatione\s*,\s*(\d{1,3})(?:\s*,\s*\d{1,3})?(?:\s*:\s*((?:PG|PL)\s+\d+\s*,\s*\d+[A-Za-z]?))?|On the Incarnation(?:\s+of the Word)?\s*,\s*(\d{1,3})(?:\s*,\s*\d{1,3})?/gi;
  for (const match of text.matchAll(re)) {
    const section = Number(match[1] || match[3]);
    if (!Number.isInteger(section) || section < 1 || section > 200) continue;
    const pg = match[2] ? match[2].replace(/\s+/g, ' ').trim() : '';
    const editionNote = pg
      ? `${pg}. El texto es el parágrafo ${section} de la edición que viaja en el corpus.`
      : `El texto es el parágrafo ${section} de la edición que viaja en el corpus.`;
    const start = match.index ?? 0;
    hits.push({
      start,
      end: start + match[0].length,
      label: match[0].trim(),
      documentId: ATHANASIUS_INCARNATION_ID,
      editionNote,
      locate: { kind: 'section', section },
    });
  }
}

function collectDiognetus(text: string, hits: RawHit[]): void {
  const re = new RegExp(
    `(?:Carta|Ep[ií]stola)\\s+a\\s+Diogneto\\s*,\\s*(${ROMAN_ALT}|\\d{1,2})(?:\\s*[\\u2012\\u2013\\u2014-]\\s*(${ROMAN_ALT}|\\d{1,2}))?`,
    'gi',
  );
  for (const match of text.matchAll(re)) {
    const startCh = chapterNumber(match[1]);
    if (startCh == null) continue;
    const endCh = match[2] ? chapterNumber(match[2]) : startCh;
    if (endCh == null || endCh < startCh || endCh - startCh > 2) continue;
    const chapters: number[] = [];
    for (let n = startCh; n <= endCh; n++) chapters.push(n);
    const start = match.index ?? 0;
    hits.push({
      start,
      end: start + match[0].length,
      label: match[0].trim(),
      documentId: DIOGNETUS_ID,
      editionNote: null,
      locate: { kind: 'chapters', chapters },
    });
  }
}

function chapterNumber(token: string): number | null {
  const text = (token || '').trim().toUpperCase();
  if (ROMAN_TO_N[text]) return ROMAN_TO_N[text];
  if (!/^\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  if (n < 1 || n > 12) return null;
  return n;
}

function collectAugustine(text: string, hits: RawHit[]): void {
  const re = new RegExp(
    `(${WORK_ALT})\\s*,?\\s*(${BOOK_ALT})\\s*[,.;]\\s*(${BOOK_ALT})(?:\\s*[,.;]\\s*(${BOOK_ALT}))?(?:\\s*:\\s*((?:PG|PL|CCL)\\s+\\d+\\s*,\\s*\\d+[A-Za-z]?))?`,
    'gi',
  );
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    const prev = start > 0 ? text[start - 1] : '';
    if (/[A-Za-zÁÉÍÓÚáéíóúüÜ]/.test(prev)) continue;
    const before = text.slice(Math.max(0, start - 64), start);
    if (/Novaciano|Novatian|Hilary|Hilario/i.test(before)) continue;
    if (/\d\.\s+\d/.test(match[0])) continue;
    const pg = match[5] ? match[5].replace(/\s+/g, ' ').trim() : '';
    if (pg && /^(?:PL\s+(?:3|10)|CCL\s+(?:4|62))\b/i.test(pg)) continue;
    const after = text.slice(endOf(start, match[0]), endOf(start, match[0]) + 12);
    if (pairList(match[0]) && /^\s*,\s*\d/.test(after)) continue;
    const book = addressNumber(match[2], 15);
    const chapter = addressNumber(match[3], 60);
    // "Confesiones, I, 1" names the book and the chapter. The opening
    // paragraph of that chapter is the text the ficha quotes.
    const paragraph = match[4] ? addressNumber(match[4], 80) : 1;
    if (book == null || chapter == null || paragraph == null) continue;
    const title = match[1];
    const documentId = /trinitate|holy\s+trinity/i.test(title)
      ? AUGUSTINE_TRINITY_ID
      : AUGUSTINE_CONFESSIONS_ID;
    const where = `libro ${book}, capítulo ${chapter}, parágrafo ${paragraph}`;
    const editionNote = pg
      ? `${pg}. El texto es el ${where} de la edición NPNF que viaja en el corpus.`
      : `El texto es el ${where} de la edición NPNF que viaja en el corpus.`;
    hits.push({
      start,
      end: start + match[0].length,
      label: match[0].trim(),
      documentId,
      editionNote,
      locate: { kind: 'bookParagraph', book, chapter, paragraph },
    });
  }
}

function endOf(start: number, raw: string): number {
  return start + raw.length;
}

/** `2,8; 2,10` is a list of pairs, not book, chapter, paragraph. */
function pairList(raw: string): boolean {
  return /\d\s*;\s*\d+\s*$/.test(raw.trim()) || /[IVXLC]+\s*;\s*\d+\s*$/i.test(raw.trim());
}

function addressNumber(token: string, max: number): number | null {
  const text = (token || '').trim().toUpperCase();
  const roman = BOOK_ROMAN[text];
  const n = roman || (/^\d{1,3}$/.test(text) ? Number(text) : 0);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

function locateUnits(
  units: readonly PassageUnitLike[],
  locate: PatristicLocate,
): number[] | null {
  if (locate.kind === 'section') return locateSection(units, locate.section);
  if (locate.kind === 'chapters') return locateChapters(units, locate.chapters);
  return locateBookParagraph(
    units,
    locate.book,
    locate.chapter,
    locate.paragraph,
  );
}

function locateSection(
  units: readonly PassageUnitLike[],
  section: number,
): number[] | null {
  const hits: number[] = [];
  for (let i = 0; i < units.length; i++) {
    if (leadingSection(units[i]?.contenido) === section) hits.push(i);
  }
  if (hits.length !== 1) return null;
  const start = hits[0];
  const out = [start];
  for (let i = start + 1; i < units.length && out.length < MAX_PASSAGE_UNITS; i++) {
    const next = leadingSection(units[i]?.contenido);
    if (next > 0 && next !== section) break;
    out.push(i);
  }
  return out;
}

function locateChapters(
  units: readonly PassageUnitLike[],
  chapters: readonly number[],
): number[] | null {
  const heads: { n: number; i: number }[] = [];
  for (let i = 0; i < units.length; i++) {
    const n = leadingRomanChapter(units[i]?.contenido);
    if (n != null) heads.push({ n, i });
  }
  const out: number[] = [];
  for (const chapter of chapters) {
    const hits = heads.filter((head) => head.n === chapter);
    if (hits.length !== 1) return null;
    const start = hits[0].i;
    const next = heads.find((head) => head.i > start);
    const end = next ? next.i : Math.min(units.length, start + MAX_PASSAGE_UNITS);
    for (let i = start; i < end && out.length < MAX_PASSAGE_UNITS; i++) {
      if (!out.includes(i)) out.push(i);
    }
  }
  return out.length ? out : null;
}

function leadingSection(raw: string | null | undefined): number {
  const match = String(raw || '').match(/^\s*(\d{1,3})\.\s/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isInteger(n) ? n : 0;
}

function locateBookParagraph(
  units: readonly PassageUnitLike[],
  book: number,
  chapter: number,
  paragraph: number,
): number[] | null {
  let bookAt = -1;
  let bookEnd = units.length;
  for (let i = 0; i < units.length; i++) {
    const n = leadingBook(units[i]?.contenido);
    if (n === book && bookAt < 0) bookAt = i;
    else if (bookAt >= 0 && n > 0) {
      bookEnd = i;
      break;
    }
  }
  if (bookAt < 0) return null;
  let chapterAt = -1;
  let chapterEnd = bookEnd;
  for (let i = bookAt + 1; i < bookEnd; i++) {
    const n = leadingNpChapter(units[i]?.contenido);
    if (n === chapter && chapterAt < 0) chapterAt = i;
    else if (chapterAt >= 0 && n > 0) {
      chapterEnd = i;
      break;
    }
  }
  if (chapterAt < 0) return null;
  const hits: number[] = [];
  for (let i = chapterAt + 1; i < chapterEnd; i++) {
    if (leadingSection(units[i]?.contenido) === paragraph) hits.push(i);
  }
  if (hits.length !== 1) return null;
  return [hits[0]];
}

function leadingBook(raw: string | null | undefined): number {
  const match = String(raw || '').match(/^\s*Book\s+(\d{1,2})\.\s*$/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isInteger(n) ? n : 0;
}

function leadingNpChapter(raw: string | null | undefined): number {
  const match = String(raw || '').match(/^\s*Chapter\s+(\d{1,3})\./);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isInteger(n) ? n : 0;
}

function leadingRomanChapter(raw: string | null | undefined): number | null {
  const match = String(raw || '').match(
    new RegExp(`^\\s*(${ROMAN_ALT})\\.\\s`),
  );
  if (!match) return null;
  return ROMAN_TO_N[match[1]] ?? null;
}
