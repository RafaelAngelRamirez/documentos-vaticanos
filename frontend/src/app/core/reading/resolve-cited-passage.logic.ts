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
 * One inclusive run of paragraph or canon numbers (`20-22`).
 * A later span (`25`, `48-51`) is a jump: the sheet draws a gap before it.
 */
export interface DocumentUnitSpan {
  start: number;
  end: number;
}

/**
 * Resolved corpus ref (`idDocumento` + `idPunto` + label).
 * Bible and other documents: ranges and lists from the label.
 * The anchor unit is the fallback when the label names no numbered run.
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

  const fromDoc = resolveDocumentPassage(
    documentId,
    displayLabel,
    anchorIndex,
    units,
  );
  if (fromDoc?.verses.length) return fromDoc;
  return singleUnitPassage(documentId, displayLabel, units, anchorIndex);
}

/**
 * Paragraph number stamped on a unit (`consecutivo`). Not an address.
 * Returns null for titles and `no-encontrado`.
 */
export function documentParagraphNumber(
  raw: string | null | undefined,
): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!/^\d{1,5}$/.test(text)) return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : null;
}

/** First loaded unit whose paragraph number is `target`. */
export function indexOfParagraphNumber(
  units: readonly PassageUnitLike[] | null | undefined,
  target: number,
): number | null {
  if (!units?.length || !Number.isInteger(target)) return null;
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (!unit) continue;
    if (documentParagraphNumber(unit.consecutivo) !== target) continue;
    return typeof unit.index_array === 'number' ? unit.index_array : i;
  }
  return null;
}

/**
 * Ranges and lists in a document citation, same separators as a lectionary
 * cite: `-` fills a run, `;` `.` `+` and `/` start another run.
 * A comma is a subsection (`GS 19,1`, `GS 78, 1-2`) and stays one unit.
 * A later document code ends the list. `anchorNumber` selects the run that
 * contains the resolved unit; without it, the first run is returned.
 */
export function parseDocumentUnitSpans(
  label: string,
  anchorNumber?: number | null,
): DocumentUnitSpan[] | null {
  const groups = parseDocumentGroups(label);
  if (!groups.length) return null;
  if (anchorNumber == null || !Number.isInteger(anchorNumber)) {
    return groups[0].spans;
  }
  const hits = groups.filter((group) =>
    group.spans.some(
      (span) => anchorNumber >= span.start && anchorNumber <= span.end,
    ),
  );
  if (!hits.length) return null;
  const starting = hits.find((group) =>
    group.spans.some((span) => span.start === anchorNumber),
  );
  return (starting || hits[0]).spans;
}

interface DocumentCiteGroup {
  code: string | null;
  spans: DocumentUnitSpan[];
}

function parseDocumentGroups(label: string): DocumentCiteGroup[] {
  const raw = (label || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const groups: DocumentCiteGroup[] = [];
  let current: DocumentCiteGroup | null = null;
  for (const atom of raw.split(';')) {
    const piece = atom.trim();
    if (!piece) continue;
    const parsed = parseDocumentAtom(piece);
    if (!parsed) {
      current = null;
      continue;
    }
    if (parsed.code) {
      if (!current || current.code !== parsed.code) {
        current = { code: parsed.code, spans: [] };
        groups.push(current);
      }
      current.spans.push(...parsed.spans);
      continue;
    }
    if (!current) {
      current = { code: null, spans: [] };
      groups.push(current);
    }
    current.spans.push(...parsed.spans);
  }
  return groups.filter((group) => group.spans.length);
}

function parseDocumentAtom(
  atom: string,
): { code: string | null; spans: DocumentUnitSpan[] } | null {
  let body = stripCitePrefix(atom).replace(/^(?:véase|vease)\s+/i, '').trim();
  body = body.replace(/^(?:cf|cfr|ver)\s*\.?\s+/i, '').trim();
  if (!body) return null;

  const ibid = body.match(/\bib[ií]d(?:em)?\.?\s*,?\s*(\d[\s\S]*)$/i);
  const coded = matchDocumentCode(body);
  if (coded) {
    const spans = parseLocatorSpec(coded.locator);
    if (!spans?.length) return null;
    return { code: coded.code, spans };
  }
  if (ibid) {
    const spans = parseLocatorSpec(ibid[1]);
    if (!spans?.length) return null;
    return { code: null, spans };
  }
  if (!/^(?:cans?\.?\s+|canon(?:es)?\.?\s+|cán(?:ones)?\.?\s+)?\d/i.test(body)) {
    return null;
  }
  const spans = parseLocatorSpec(body);
  if (!spans?.length) return null;
  return { code: null, spans };
}

function matchDocumentCode(
  body: string,
): { code: string; locator: string } | null {
  const re =
    /(?:^|[\s:(])([A-ZÁÉÍÓÚÑ]{1,8})\s+((?:cans?\.?\s+|canon(?:es)?\.?\s+|cán(?:ones)?\.?\s+)?\d{1,5}\b[\s\S]*)$/g;
  let found: { code: string; locator: string } | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    found = { code: match[1], locator: match[2] };
  }
  return found;
}

function parseLocatorSpec(spec: string): DocumentUnitSpan[] | null {
  let text = spec.trim().replace(
    /^(?:cans?|canon(?:es)?|cán(?:ones)?)\.?\s+/i,
    '',
  );
  if (!/^\d/.test(text)) return null;
  const spans: DocumentUnitSpan[] = [];
  for (const bit of text.split(/[.+/]/)) {
    const piece = bit.trim();
    if (!piece) continue;
    if (/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/.test(piece)) break;
    const bitSpans = parseLocatorBit(piece);
    if (!bitSpans?.length) break;
    spans.push(...bitSpans);
  }
  return spans.length ? spans : null;
}

function parseLocatorBit(bit: string): DocumentUnitSpan[] | null {
  const text = bit.trim();
  if (!text) return null;
  const range = text.match(
    /^(\d{1,5})\s*[\u2012\u2013\u2014\u2212-]\s*(\d{1,5})\b(.*)$/,
  );
  const comma = text.search(/[,，]/);
  const hyphen = text.search(/[\u2012\u2013\u2014\u2212-]/);
  if (range && (comma < 0 || (hyphen >= 0 && hyphen < comma))) {
    const start = Number(range[1]);
    let end = Number(range[2]);
    if (end < start) {
      const expanded = expandShortRangeEnd(start, end);
      if (expanded == null) return null;
      end = expanded;
    }
    if (end - start > 500) return [{ start, end: start }];
    const spans: DocumentUnitSpan[] = [{ start, end }];
    const rest = range[3].trim().replace(/^[,，]\s*/, '');
    if (
      rest &&
      rest.length < text.length &&
      !/^§/.test(rest) &&
      /^(\d{1,5})\b/.test(rest)
    ) {
      const next = Number(/^(\d{1,5})\b/.exec(rest)?.[1]);
      if (next >= 10) {
        const more = parseLocatorBit(rest);
        if (more?.length) spans.push(...more);
      }
    }
    return spans;
  }
  const single = text.match(/^(\d{1,5})\b/);
  if (!single) return null;
  return [{ start: Number(single[1]), end: Number(single[1]) }];
}

/** `1712-13` is 1712–1713. A longer tail is not an abbreviation. */
function expandShortRangeEnd(start: number, end: number): number | null {
  const tail = String(end);
  const head = String(start);
  if (tail.length >= head.length) return null;
  const merged = Number(head.slice(0, head.length - tail.length) + tail);
  if (!Number.isInteger(merged) || merged < start) return null;
  if (merged - start > 30) return null;
  return merged;
}

function resolveDocumentPassage(
  documentId: string,
  displayLabel: string,
  anchorIndex: number,
  units: readonly PassageUnitLike[],
): CitedPassage | null {
  const anchorUnit = unitAt(units, anchorIndex);
  const anchorNumber = documentParagraphNumber(anchorUnit?.consecutivo);
  const spans = parseDocumentUnitSpans(displayLabel, anchorNumber);
  if (!spans?.length) return null;
  const verses = collectDocumentUnits(units, spans);
  if (!verses.length) return null;
  if (
    anchorNumber != null &&
    !verses.some((verse) => verse.verse === anchorNumber)
  ) {
    return null;
  }
  return {
    documentId,
    displayLabel,
    verses,
    speechText: passageSpeechText(verses),
  };
}

function collectDocumentUnits(
  units: readonly PassageUnitLike[],
  spans: readonly DocumentUnitSpan[],
): CitedVerse[] {
  const byNumber = new Map<number, { unit: PassageUnitLike; index: number }>();
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (!unit) continue;
    const n = documentParagraphNumber(unit.consecutivo);
    if (n == null || byNumber.has(n)) continue;
    const index = typeof unit.index_array === 'number' ? unit.index_array : i;
    byNumber.set(n, { unit, index });
  }
  const seen = new Set<number>();
  const out: CitedVerse[] = [];
  let spanOrdinal = 0;
  for (const span of spans) {
    const breakBefore = spanOrdinal > 0;
    let added = 0;
    for (let n = span.start; n <= span.end; n++) {
      if (seen.has(n)) continue;
      const hit = byNumber.get(n);
      if (!hit) continue;
      const text = plainUnitText(hit.unit.contenido, n);
      if (!text) continue;
      seen.add(n);
      out.push({
        index: hit.index,
        chapter: 0,
        verse: n,
        text,
        spanBreakBefore: breakBefore && added === 0,
      });
      added += 1;
    }
    if (added > 0) spanOrdinal += 1;
  }
  return out;
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
