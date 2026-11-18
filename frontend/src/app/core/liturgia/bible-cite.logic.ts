/**
 * Map lectionary citations (Mt 19,23-30, Ap 3,1-6.14-22) onto bible pack units.
 * A dot is a jump: the verses in the gap are not part of the reading.
 */

import { prepareSpeechText } from '../../services/speech-prep.logic';

export interface ParsedCite {
  code: string;
  chapter: string;
  verse: number;
  display: string;
}

/**
 * One slice of a citation, in reading order.
 * `start == null` is the whole chapter.
 * `chapterEnd` set means the slice runs through that chapter and `verseEnd`.
 */
export interface PassageSpan {
  chapter: number;
  start: number | null;
  end: number | null;
  chapterEnd: number | null;
  verseEnd: number | null;
}

export interface ParsedPassage {
  code: string;
  display: string;
  spans: PassageSpan[];
}

/** One cited verse taken from the offline bible, with the gap verses left out. */
export interface CitedVerse {
  index: number;
  chapter: number;
  verse: number;
  text: string;
  /**
   * True on the first verse of a later citation span (dot / semicolon / plus jump).
   * The pasaje UI draws a discreet break before that verse.
   */
  spanBreakBefore: boolean;
}

/** Abbreviations used in the Roman weekday/Sunday lectionary → corpus `biblia.libro`. */
export const LECT_BOOK_SLUG: Record<string, string> = {
  Gn: 'genesis',
  Ex: 'exodo',
  Lv: 'levitico',
  Nm: 'numeros',
  Dt: 'deuteronomio',
  Jos: 'josue',
  Jc: 'jueces',
  Jue: 'jueces',
  Rt: 'rut',
  '1S': 'primer libro de samuel',
  '2S': 'segundo libro de samuel',
  '1R': 'primer libro de los reyes',
  '2R': 'segundo libro de los reyes',
  '1Cro': 'primer libro de las cronicas',
  '2Cro': 'segundo libro de las cronicas',
  Esd: 'esdras',
  Ne: 'nehemias',
  Tb: 'tobias',
  Jdt: 'judit',
  Est: 'ester',
  '1M': 'primer libro de los macabeos',
  '2M': 'segundo libro de los macabeos',
  Jb: 'job',
  Job: 'job',
  Sal: 'salmos',
  Pr: 'proverbios',
  Qo: 'eclesiastes',
  Ct: 'cantar de los cantares',
  Sb: 'sabiduria',
  Si: 'eclesiastico',
  Eclo: 'eclesiastico',
  Is: 'isaias',
  Jr: 'jeremias',
  Lm: 'lamentaciones',
  Ba: 'baruc',
  Ez: 'ezequiel',
  Dn: 'daniel',
  Os: 'oseas',
  Jl: 'joel',
  Am: 'amos',
  Ab: 'abdias',
  Jon: 'jonas',
  Mi: 'miqueas',
  Na: 'nahum',
  Ha: 'habacuc',
  So: 'sofonias',
  Ag: 'ageo',
  Za: 'zacarias',
  Ml: 'malaquias',
  Mt: 'evangelio segun san mateo',
  Mc: 'evangelio segun san marcos',
  Lc: 'evangelio segun san lucas',
  Jn: 'evangelio segun san juan',
  Hch: 'hechos de los apostoles',
  Rm: 'carta a los romanos',
  '1Co': 'primera carta a los corintios',
  '2Co': 'segunda carta a los corintios',
  Ga: 'carta a los galatas',
  Ef: 'carta a los efesios',
  Flp: 'carta a los filipenses',
  Col: 'carta a los colosenses',
  '1Ts': 'primera carta a los tesalonicenses',
  '2Ts': 'segunda carta a los tesalonicenses',
  '1Tm': 'primera carta a timoteo',
  '2Tm': 'segunda carta a timoteo',
  Tt: 'carta a tito',
  Flm: 'carta a filemon',
  Hb: 'carta a los hebreos',
  St: 'carta de santiago',
  '1P': 'primera carta de san pedro',
  '2P': 'segunda carta de san pedro',
  '1Jn': 'primera carta de san juan',
  '2Jn': 'segunda carta de san juan',
  '3Jn': 'tercera carta de san juan',
  Judas: 'carta de san judas',
  Ap: 'apocalipsis',
};

const CITE_RE = /^([1-3]?[A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+(.+)$/u;
const CROSS_RE =
  /^(\d+)[a-dA-D]*\s*[\u2012\u2013\u2014\u2212-]\s*(\d+)\s*,\s*(\d+)[a-dA-D]*$/;
const RANGE_RE =
  /^(\d+)[a-dA-D]*\s*[\u2012\u2013\u2014\u2212-]\s*(\d+)[a-dA-D]*$/;
const SINGLE_RE = /^(\d+)[a-dA-D]*$/;

function verseSpan(chapter: number, start: number, end: number): PassageSpan {
  return { chapter, start, end, chapterEnd: null, verseEnd: null };
}

function wholeChapter(chapter: number): PassageSpan {
  return {
    chapter,
    start: null,
    end: null,
    chapterEnd: null,
    verseEnd: null,
  };
}

/** First verse of the first span. Whole-chapter cites start at verse 1. */
export function parseLectionaryCite(
  raw: string | null | undefined,
): ParsedCite | null {
  const passage = parseLectionaryPassage(raw);
  if (!passage) return null;
  const first = passage.spans[0];
  return {
    code: passage.code,
    chapter: String(first.chapter),
    verse: first.start ?? 1,
    display: passage.display,
  };
}

/**
 * Ranges and jumps. `Ap 3,1-6.14-22` is verses 1–6 and 14–22 of chapter 3.
 * A semicolon starts another chapter of the same book (`Ap 1,1-4;2,1-5`).
 * An en dash runs across chapters (`Mt 9,35–10,1`). A plus joins verses
 * (`Sal 118,1+8-9`). A letter (`12a`, `4cd`) stays on that whole verse.
 * `Flm 7-20` is verses of the single chapter. `Sal 15` is the whole psalm.
 */
export function parseLectionaryPassage(
  raw: string | null | undefined,
): ParsedPassage | null {
  const display = (raw || '').trim();
  if (!display) return null;
  const match = display.match(CITE_RE);
  if (!match) return null;
  const spans: PassageSpan[] = [];
  for (const segment of match[2].split(';')) {
    const part = parseSegment(segment);
    if (!part) return null;
    spans.push(...part);
  }
  if (!spans.length) return null;
  return { code: match[1], display, spans };
}

function parseSegment(segment: string): PassageSpan[] | null {
  let text = segment.trim();
  if (!text) return null;
  if (!text.includes(',') && text.includes(':')) {
    text = text.replace(':', ',');
  }
  if (/^\d+$/.test(text)) {
    const chapter = Number(text);
    return chapter >= 1 ? [wholeChapter(chapter)] : null;
  }
  const comma = text.indexOf(',');
  if (comma === -1) return parseVerseSpec(text, 1);
  const chapter = Number(text.slice(0, comma).trim());
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const spec = text.slice(comma + 1).trim();
  if (!spec) return null;
  return parseVerseSpec(spec, chapter);
}

function parseVerseSpec(spec: string, chapter: number): PassageSpan[] | null {
  const bits = spec
    .split('.')
    .map((bit) => bit.trim())
    .filter(Boolean);
  if (!bits.length) return null;
  let current = chapter;
  const spans: PassageSpan[] = [];
  for (const bit of bits) {
    const parsed = parseBit(bit, current);
    if (!parsed) return null;
    spans.push(...parsed);
    const last = parsed[parsed.length - 1];
    current = last.chapterEnd ?? last.chapter;
  }
  return spans;
}

function parseBit(bit: string, chapter: number): PassageSpan[] | null {
  const text = bit.trim();
  if (!text) return null;
  if (text.includes(',')) {
    const cross = text.match(CROSS_RE);
    if (!cross) return null;
    const start = Number(cross[1]);
    const chapterEnd = Number(cross[2]);
    const verseEnd = Number(cross[3]);
    if (chapterEnd < chapter) return null;
    if (chapterEnd === chapter && verseEnd < start) return null;
    return [
      {
        chapter,
        start,
        end: null,
        chapterEnd,
        verseEnd,
      },
    ];
  }
  if (text.includes('+')) {
    const spans: PassageSpan[] = [];
    for (const piece of text.split('+')) {
      const span = parseSimple(piece.trim(), chapter);
      if (!span) return null;
      spans.push(span);
    }
    return spans.length ? spans : null;
  }
  const span = parseSimple(text, chapter);
  return span ? [span] : null;
}

function parseSimple(text: string, chapter: number): PassageSpan | null {
  if (!text) return null;
  const range = text.match(RANGE_RE);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (end < start) return null;
    return verseSpan(chapter, start, end);
  }
  const single = text.match(SINGLE_RE);
  if (!single) return null;
  const verse = Number(single[1]);
  return verseSpan(chapter, verse, verse);
}

export function bookSlugForCode(code: string): string | null {
  if (!code) return null;
  if (LECT_BOOK_SLUG[code]) return LECT_BOOK_SLUG[code];
  const fold = code.normalize('NFD').replace(/\p{M}/gu, '');
  return LECT_BOOK_SLUG[fold] || null;
}

function plainVerseText(raw: string, verse: number): string {
  const plain = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const stripped = plain.replace(new RegExp(`^${verse}[.)]?\\s+`), '').trim();
  return stripped || plain;
}

interface IndexedVerse {
  index: number;
  chapter: number;
  verse: number;
  contenido: string;
}

/**
 * Verses named by the citation, in that order, from the offline bible units.
 * A jump does not pull in the verses that sit between the spans.
 * A cited verse that the pack does not contain is left out.
 * Single-chapter books stored as chapter 0 (Filemón, Judas, 2 Jn) match a
 * citation that names chapter 1.
 */
export function collectCitedVerses(
  units: readonly BibleUnitLike[] | null | undefined,
  passage: ParsedPassage,
): CitedVerse[] {
  const slug = bookSlugForCode(passage.code);
  if (!slug || !units?.length) return [];
  const byKey = new Map<string, IndexedVerse>();
  const byChapter = new Map<number, IndexedVerse[]>();
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const biblia = unit?.biblia;
    if (!biblia || (biblia.libro || '') !== slug) continue;
    const chapter = Number(biblia.capitulo);
    const verse = Number(biblia.versiculo);
    if (!Number.isInteger(chapter) || !Number.isInteger(verse)) continue;
    const index = typeof unit.index_array === 'number' ? unit.index_array : i;
    const row: IndexedVerse = {
      index,
      chapter,
      verse,
      contenido: (unit as { contenido?: string }).contenido || '',
    };
    const key = `${chapter}:${verse}`;
    if (!byKey.has(key)) byKey.set(key, row);
    const list = byChapter.get(chapter);
    if (list) list.push(row);
    else byChapter.set(chapter, [row]);
  }
  for (const list of byChapter.values()) {
    list.sort((a, b) => a.verse - b.verse || a.index - b.index);
  }
  const present = new Set(byChapter.keys());
  const storedChapter = (chapter: number): number => {
    if (present.has(chapter)) return chapter;
    if (chapter === 1 && present.size === 1 && present.has(0)) return 0;
    return chapter;
  };
  const seen = new Set<string>();
  const out: CitedVerse[] = [];
  let spanOrdinal = 0;
  const push = (row: IndexedVerse, breakBefore: boolean): void => {
    const key = `${row.chapter}:${row.verse}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      index: row.index,
      chapter: row.chapter,
      verse: row.verse,
      text: plainVerseText(row.contenido, row.verse),
      spanBreakBefore: breakBefore,
    });
  };
  for (const span of passage.spans) {
    const breakBefore = spanOrdinal > 0;
    let added = 0;
    const pushSpan = (row: IndexedVerse): void => {
      const before = out.length;
      push(row, breakBefore && added === 0);
      if (out.length > before) added += 1;
    };
    const chapter = storedChapter(span.chapter);
    if (span.start == null) {
      for (const row of byChapter.get(chapter) || []) pushSpan(row);
    } else if (span.chapterEnd != null && span.verseEnd != null) {
      const endChapter = storedChapter(span.chapterEnd);
      const chapters = [...byChapter.keys()]
        .filter((ch) => ch >= chapter && ch <= endChapter)
        .sort((a, b) => a - b);
      for (const ch of chapters) {
        for (const row of byChapter.get(ch) || []) {
          if (ch === chapter && row.verse < span.start) continue;
          if (ch === endChapter && row.verse > span.verseEnd) continue;
          pushSpan(row);
        }
      }
    } else {
      const end = span.end ?? span.start;
      for (let verse = span.start; verse <= end; verse++) {
        const row = byKey.get(`${chapter}:${verse}`);
        if (row) pushSpan(row);
      }
    }
    if (added > 0) spanOrdinal += 1;
  }
  return out;
}

/** Spoken text of the cited verses only. Skipped verses are not included. */
export function passageSpeechText(
  verses: readonly { text: string }[] | null | undefined,
): string {
  const parts: string[] = [];
  for (const verse of verses || []) {
    const prep = prepareSpeechText(verse.text);
    if (!prep.skip && prep.text) parts.push(prep.text);
  }
  return parts.join(' ');
}

export interface BibleUnitLike {
  biblia?: {
    libro?: string;
    capitulo?: string;
    versiculo?: number;
  };
  index_array?: number;
}

export function findBibleUnitIndex(
  units: BibleUnitLike[] | null | undefined,
  cite: ParsedCite,
): number | null {
  const passage = parseLectionaryPassage(cite.display);
  if (passage) {
    const cited = collectCitedVerses(units, passage);
    if (cited.length) return cited[0].index;
  }
  const slug = bookSlugForCode(cite.code);
  if (!slug || !units?.length) return null;
  const ch = String(cite.chapter);
  for (let i = 0; i < units.length; i++) {
    const b = units[i]?.biblia;
    if (!b) continue;
    if ((b.libro || '') !== slug) continue;
    if (String(b.capitulo) !== ch) continue;
    if (Number(b.versiculo) === cite.verse) {
      const idx = units[i].index_array;
      return typeof idx === 'number' ? idx : i;
    }
  }
  // Fallback: first verse of that chapter.
  for (let i = 0; i < units.length; i++) {
    const b = units[i]?.biblia;
    if ((b?.libro || '') === slug && String(b?.capitulo) === ch) {
      const idx = units[i].index_array;
      return typeof idx === 'number' ? idx : i;
    }
  }
  return null;
}
