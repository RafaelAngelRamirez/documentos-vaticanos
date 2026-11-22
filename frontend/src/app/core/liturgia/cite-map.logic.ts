/**
 * Ship cite-map: libro → capítulo → versículo → unitIndex.
 * Preloads only the units a citation needs so resolveCitedPassage*
 * never waits on a full bible JSON.parse.
 */

import {
  bookSlugForCode,
  type ParsedPassage,
  type PassageSpan,
} from './bible-cite.logic';

export interface BibleCiteMap {
  v: 1;
  books: Record<string, Record<string, Record<string, number>>>;
}

export interface CiteUnitLike {
  biblia?: {
    libro?: string;
    capitulo?: string;
    versiculo?: number;
  };
}

/** Half-open [from, to) ranges of unit indexes to hydrate. */
export type UnitRange = { from: number; to: number };

/**
 * Build the compact map from packed units. Returns null when no `biblia`
 * metadata is present (translated siblings without structure).
 */
export function buildBibleCiteMap(
  units: readonly (CiteUnitLike | null | undefined)[] | null | undefined,
): BibleCiteMap | null {
  if (!units?.length) return null;
  const books: BibleCiteMap['books'] = {};
  let hits = 0;
  for (let i = 0; i < units.length; i++) {
    const b = units[i]?.biblia;
    if (!b?.libro) continue;
    const libro = String(b.libro);
    const ch = String(b.capitulo ?? '');
    const v = String(b.versiculo ?? '');
    if (!books[libro]) books[libro] = {};
    if (!books[libro][ch]) books[libro][ch] = {};
    if (books[libro][ch][v] == null) {
      books[libro][ch][v] = i;
      hits += 1;
    }
  }
  if (!hits) return null;
  return { v: 1, books };
}

/**
 * Unit indexes named by the passage, in citation order.
 * Missing verses are omitted (same rule as the passage resolver).
 */
export function unitIndexesForPassage(
  map: BibleCiteMap | null | undefined,
  passage: ParsedPassage,
): number[] {
  const slug = bookSlugForCode(passage.code);
  if (!slug || !map?.books?.[slug]) return [];
  const book = map.books[slug];
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (idx: number | undefined): void => {
    if (typeof idx !== 'number' || seen.has(idx)) return;
    seen.add(idx);
    out.push(idx);
  };
  for (const span of passage.spans) {
    for (const idx of indexesForSpan(book, span)) push(idx);
  }
  return out;
}

interface VerseRef {
  index: number;
  chapter: number;
  verse: number;
}

function verseRefsForSpan(
  book: Record<string, Record<string, number>>,
  span: PassageSpan,
): VerseRef[] {
  const out: VerseRef[] = [];
  const push = (chapter: number, verse: number): void => {
    const index = book[String(chapter)]?.[String(verse)];
    if (typeof index === 'number') out.push({ index, chapter, verse });
  };
  if (span.start == null) {
    const chapterMap = book[String(span.chapter)] || {};
    const verses = Object.keys(chapterMap)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    for (const verse of verses) push(span.chapter, verse);
    return out;
  }
  if (span.chapterEnd != null && span.verseEnd != null) {
    for (let ch = span.chapter; ch <= span.chapterEnd; ch++) {
      const chapterMap = book[String(ch)] || {};
      const verses = Object.keys(chapterMap)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      for (const verse of verses) {
        if (ch === span.chapter && verse < (span.start ?? 0)) continue;
        if (ch === span.chapterEnd && verse > span.verseEnd) continue;
        push(ch, verse);
      }
    }
    return out;
  }
  const end = span.end ?? span.start;
  for (let verse = span.start; verse <= end; verse++) {
    push(span.chapter, verse);
  }
  return out;
}

function indexesForSpan(
  book: Record<string, Record<string, number>>,
  span: PassageSpan,
): number[] {
  return verseRefsForSpan(book, span).map((ref) => ref.index);
}

/**
 * A translation pack keeps the Spanish unit index but drops `biblia`.
 * Stamp the cited verses onto those units so the passage resolver can
 * read them. Verses the citation skips stay unmarked.
 */
export function addressUnitsFromCiteMap<
  T extends CiteUnitLike & { contenido?: string },
>(
  units: readonly (T | null | undefined)[] | null | undefined,
  map: BibleCiteMap | null | undefined,
  passage: ParsedPassage | null | undefined,
): T[] {
  const list: T[] = units ? (units.slice() as T[]) : [];
  const slug = passage ? bookSlugForCode(passage.code) : null;
  const book = slug && map?.books ? map.books[slug] : undefined;
  if (!book || !passage || !slug) return list;
  for (const span of passage.spans) {
    for (const ref of verseRefsForSpan(book, span)) {
      const unit = list[ref.index];
      if (!unit || unit.biblia?.libro) continue;
      list[ref.index] = {
        ...unit,
        biblia: {
          libro: slug,
          capitulo: String(ref.chapter),
          versiculo: ref.verse,
          consecutivo_versiculo: `${slug} ${ref.chapter}, ${ref.verse}`,
          index_general: String(ref.index),
        },
      } as T;
    }
  }
  return list;
}

/**
 * Merge sorted indexes into half-open ranges.
 * Gaps larger than `maxGap` stay separate so discontinuous cites do not
 * pull the whole book.
 */
export function mergeUnitRanges(
  indexes: readonly number[],
  maxGap = 40,
): UnitRange[] {
  if (!indexes.length) return [];
  const sorted = [
    ...new Set(indexes.filter((n) => Number.isInteger(n) && n >= 0)),
  ].sort((a, b) => a - b);
  if (!sorted.length) return [];
  const ranges: UnitRange[] = [];
  let from = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n - prev <= maxGap) {
      prev = n;
      continue;
    }
    ranges.push({ from, to: prev + 1 });
    from = n;
    prev = n;
  }
  ranges.push({ from, to: prev + 1 });
  return ranges;
}
