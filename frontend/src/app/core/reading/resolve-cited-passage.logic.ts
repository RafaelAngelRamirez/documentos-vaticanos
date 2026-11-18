/**
 * One door for cited-only passages: day reading, bible cross-refs, and
 * doc-to-doc refs. UI (pasaje / hoja) and preload (ensureLoaded) feed this;
 * they do not invent a second extract path.
 */

import {
  collectCitedVerses,
  parseLectionaryPassage,
  passageSpeechText,
  type BibleUnitLike,
  type CitedVerse,
} from '../liturgia/bible-cite.logic';

export interface PassageUnitLike extends BibleUnitLike {
  contenido?: string;
  consecutivo?: string;
}

export interface CitedPassage {
  documentId: string;
  displayLabel: string;
  verses: CitedVerse[];
  speechText: string;
}

export function isOfflineBibleId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('bible-');
}

/** Drop cf./cfr./ver so the lectionary parser sees the book code. */
export function stripCitePrefix(label: string): string {
  return (label || '')
    .trim()
    .replace(/^(?:cf\.|cfr\.|ver)\s+/i, '')
    .trim();
}

/**
 * Fold spaced book codes (`1 Jn` → `1Jn`) for the lectionary parser.
 * Keeps the display label untouched; only the parse input is folded.
 */
export function normalizeCiteForParse(label: string): string {
  return stripCitePrefix(label).replace(
    /^([1-3])\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+)/u,
    '$1$2',
  );
}

/**
 * Lectionary / day-reading cite (`Ap 3,1-6.14-22`) against an offline pack.
 */
export function resolveCitedPassageFromCite(
  documentId: string,
  cite: string,
  units: readonly PassageUnitLike[] | null | undefined,
): CitedPassage | null {
  const displayLabel = (cite || '').trim();
  if (!displayLabel || !documentId) return null;
  const passage = parseLectionaryPassage(normalizeCiteForParse(displayLabel));
  if (!passage) return null;
  const verses = collectCitedVerses(units, passage);
  if (!verses.length) return null;
  return {
    documentId,
    displayLabel,
    verses,
    speechText: passageSpeechText(verses),
  };
}

/**
 * Resolved corpus ref (`idDocumento` + `idPunto` + label).
 * Bible: discontinuous ranges from the label. Other docs: the anchored unit only.
 */
export function resolveCitedPassageFromLocalRef(
  documentId: string,
  anchorIndex: number,
  label: string,
  units: readonly PassageUnitLike[] | null | undefined,
): CitedPassage | null {
  const displayLabel = (label || '').trim() || documentId;
  if (!documentId || !units?.length) return null;
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0) return null;

  if (isOfflineBibleId(documentId)) {
    const fromCite = resolveCitedPassageFromCite(
      documentId,
      displayLabel,
      units,
    );
    if (fromCite?.verses.length) return fromCite;
    return singleUnitPassage(documentId, displayLabel, units, anchorIndex);
  }

  return singleUnitPassage(documentId, displayLabel, units, anchorIndex);
}

function singleUnitPassage(
  documentId: string,
  displayLabel: string,
  units: readonly PassageUnitLike[],
  anchorIndex: number,
): CitedPassage | null {
  const unit = unitAt(units, anchorIndex);
  if (!unit) return null;
  const index =
    typeof unit.index_array === 'number' ? unit.index_array : anchorIndex;
  const biblia = unit.biblia;
  const verse =
    biblia && Number.isFinite(Number(biblia.versiculo))
      ? Number(biblia.versiculo)
      : consecutivoNum(unit.consecutivo);
  const chapter =
    biblia && Number.isFinite(Number(biblia.capitulo))
      ? Number(biblia.capitulo)
      : 0;
  const text = plainUnitText(unit.contenido, verse > 0 ? verse : 0);
  if (!text) return null;
  const verses: CitedVerse[] = [
    {
      index,
      chapter,
      verse: verse > 0 ? verse : 0,
      text,
      spanBreakBefore: false,
    },
  ];
  return {
    documentId,
    displayLabel,
    verses,
    speechText: passageSpeechText(verses),
  };
}

function unitAt(
  units: readonly PassageUnitLike[],
  index: number,
): PassageUnitLike | null {
  const direct = units[index];
  if (
    direct &&
    (direct.index_array == null || direct.index_array === index)
  ) {
    return direct;
  }
  for (const unit of units) {
    if (unit && unit.index_array === index) return unit;
  }
  return direct ?? null;
}

function consecutivoNum(raw: string | null | undefined): number {
  if (!raw || raw === 'no-encontrado') return 0;
  const m = String(raw).trim().match(/(\d+)/);
  return m ? Number(m[1]) : 0;
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
