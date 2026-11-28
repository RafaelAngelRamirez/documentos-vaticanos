/**
 * One step outside a cited run: the previous or next unit in the offline pack.
 * The cited verses stay in the passage; this does not fill a jump inside it.
 */

import {
  documentParagraphNumber,
  type PassageUnitLike,
} from './resolve-cited-passage.logic';

export interface CitedContextVerse {
  index: number;
  chapter: number;
  verse: number;
  text: string;
}

export type CitedContextStep =
  | { kind: 'end' }
  | { kind: 'load'; index: number }
  | { kind: 'skip'; edge: number }
  | { kind: 'verse'; verse: CitedContextVerse; edge: number };

/** Index just outside `edge`, or null at the start or end of the pack. */
export function nextCitedContextIndex(
  edge: number,
  direction: 'before' | 'after',
  unitCount: number,
): number | null {
  if (!Number.isInteger(edge) || !Number.isInteger(unitCount) || unitCount <= 0) {
    return null;
  }
  const index = direction === 'before' ? edge - 1 : edge + 1;
  if (index < 0 || index >= unitCount) return null;
  return index;
}

/**
 * Text of one loaded unit. Null when the unit is missing or has no words.
 * A bible verse number, then a paragraph number, labels the line.
 */
export function citedContextVerse(
  unit: PassageUnitLike | null | undefined,
  index: number,
): CitedContextVerse | null {
  if (!unit || !Number.isInteger(index) || index < 0) return null;
  const biblia = unit.biblia;
  const chapterRaw = biblia ? Number(biblia.capitulo) : 0;
  const chapter = Number.isInteger(chapterRaw) ? chapterRaw : 0;
  const bibleVerse = biblia ? Number(biblia.versiculo) : 0;
  const paragraph = documentParagraphNumber(unit.consecutivo);
  const verse =
    Number.isInteger(bibleVerse) && bibleVerse > 0
      ? bibleVerse
      : paragraph != null && paragraph > 0
        ? paragraph
        : 0;
  const text = plainUnitText(unit.contenido, verse);
  if (!text) return null;
  const stored = typeof unit.index_array === 'number' ? unit.index_array : index;
  return { index: stored, chapter, verse, text };
}

/**
 * The next unit outside the cited edge.
 * `load` means that index is not in memory yet.
 * `skip` means it is loaded and empty, so the edge moves past it.
 */
export function stepCitedContext(
  units: readonly (PassageUnitLike | null | undefined)[] | null | undefined,
  edge: number,
  direction: 'before' | 'after',
  unitCount: number,
): CitedContextStep {
  const index = nextCitedContextIndex(edge, direction, unitCount);
  if (index == null) return { kind: 'end' };
  const unit = units?.[index];
  if (!unit) return { kind: 'load', index };
  const verse = citedContextVerse(unit, index);
  if (!verse) return { kind: 'skip', edge: index };
  return { kind: 'verse', verse, edge: index };
}

function plainUnitText(raw: string | null | undefined, verse: number): string {
  const plain = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (verse > 0) {
    const stripped = plain.replace(new RegExp(`^${verse}[.)]?\\s+`), '').trim();
    return stripped || plain;
  }
  return plain;
}
