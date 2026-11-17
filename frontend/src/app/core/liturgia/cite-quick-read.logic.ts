/**
 * Texto citado de una referencia bíblica ya resuelta en el corpus offline.
 * El ancla es `idPunto` (unidad del pack). El libro no se vuelve a parsear:
 * si el parser de citas trae `verseEnd` o `verses`, se usa; si no, el
 * intervalo numérico del rótulo (14-26, 8.16) recorta el mismo capítulo.
 */

import {
  parseLectionaryCite,
  type ParsedCite,
} from './bible-cite.logic';

const MAX_SPAN = 80;

export interface QuickReadUnit {
  contenido?: string;
  index_array?: number;
  biblia?: {
    libro?: string;
    capitulo?: string;
    versiculo?: number;
  };
}

export interface QuickVerse {
  verse: number;
  text: string;
}

type SpanCite = ParsedCite & {
  verseEnd?: number;
  verses?: number[];
};

export function isOfflineBibleId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('bible-');
}

/**
 * Versículos del pasaje citado. Vacío si el ancla no está en el pack.
 * No inventa texto: un versículo que falta en el capítulo se omite.
 */
export function quickReadVerses(
  units: readonly (QuickReadUnit | null | undefined)[] | null | undefined,
  anchorIndex: number,
  label: string,
): QuickVerse[] {
  if (!units || !Number.isInteger(anchorIndex) || anchorIndex < 0) return [];
  const anchor = unitAt(units, anchorIndex);
  if (!anchor) return [];

  const book = (anchor.biblia?.libro || '').trim();
  const chapter = String(anchor.biblia?.capitulo ?? '');
  const anchorVerse = Number(anchor.biblia?.versiculo);
  const verses =
    book && chapter && Number.isFinite(anchorVerse)
      ? citedVerseNumbers(label, anchorVerse)
      : [];

  if (!verses.length) {
    const text = verseBody(anchor.contenido, Number.isFinite(anchorVerse) ? anchorVerse : 0);
    return text ? [{ verse: Number.isFinite(anchorVerse) ? anchorVerse : 0, text }] : [];
  }

  const wanted = new Set(verses);
  const found = new Map<number, string>();
  for (const unit of units) {
    if (!unit?.biblia) continue;
    if ((unit.biblia.libro || '').trim() !== book) continue;
    if (String(unit.biblia.capitulo ?? '') !== chapter) continue;
    const verse = Number(unit.biblia.versiculo);
    if (!wanted.has(verse) || found.has(verse)) continue;
    const text = verseBody(unit.contenido, verse);
    if (text) found.set(verse, text);
  }

  return verses
    .filter((verse) => found.has(verse))
    .map((verse) => ({ verse, text: found.get(verse) as string }));
}

function unitAt(
  units: readonly (QuickReadUnit | null | undefined)[],
  index: number,
): QuickReadUnit | null {
  const direct = units[index];
  if (direct && (direct.index_array == null || direct.index_array === index)) {
    return direct;
  }
  for (const unit of units) {
    if (unit && unit.index_array === index) return unit;
  }
  return direct ?? null;
}

function citedVerseNumbers(label: string, anchorVerse: number): number[] {
  const fromParser = parserSpan(label);
  if (fromParser) return clamp(fromParser);
  return clamp(numericSpan(label, anchorVerse));
}

/** Rango que ya declaró el parser de citas (`verseEnd` / `verses`). */
function parserSpan(label: string): number[] | null {
  const raw = (label || '').trim();
  const folded = raw.replace(/^(?:cf\.|cfr\.|ver)\s+/i, '');
  const candidates = folded === raw ? [raw] : [raw, folded];
  for (const candidate of candidates) {
    const parsed = parseLectionaryCite(candidate) as SpanCite | null;
    if (!parsed) continue;
    if (Array.isArray(parsed.verses) && parsed.verses.length) {
      const list = parsed.verses.map((n) => Number(n)).filter((n) => n > 0);
      if (list.length) return list;
    }
    if (
      typeof parsed.verseEnd === 'number' &&
      parsed.verseEnd >= parsed.verse &&
      parsed.verse > 0
    ) {
      const out: number[] = [];
      for (let verse = parsed.verse; verse <= parsed.verseEnd; verse++) {
        out.push(verse);
      }
      return out;
    }
  }
  return null;
}

/** Cola numérica del rótulo a partir del versículo ancla. Sin mapa de libros. */
function numericSpan(label: string, anchorVerse: number): number[] {
  if (!Number.isFinite(anchorVerse) || anchorVerse <= 0) return [];
  const src = (label || '').replace(/[–—]/g, '-');
  const range = src.match(
    new RegExp(`(?:^|\\D)${anchorVerse}\\s*-\\s*(\\d+)(?!\\d)`),
  );
  if (range) {
    const end = Number(range[1]);
    if (end >= anchorVerse) {
      const out: number[] = [];
      for (let verse = anchorVerse; verse <= end; verse++) out.push(verse);
      return out;
    }
  }
  const dotted = src.match(
    new RegExp(`(?:^|\\D)${anchorVerse}((?:\\s*\\.\\s*\\d+)+)(?!\\d)`),
  );
  if (dotted) {
    const extras = dotted[1]
      .split('.')
      .map((part) => Number(part.trim()))
      .filter((n) => n > 0);
    return [anchorVerse, ...extras];
  }
  return [anchorVerse];
}

function clamp(verses: number[]): number[] {
  if (verses.length <= MAX_SPAN) return verses;
  return verses.slice(0, MAX_SPAN);
}

export function verseBody(raw: string | null | undefined, verse: number): string {
  let text = stripTags(raw);
  if (verse > 0) {
    text = text.replace(new RegExp(`^${verse}\\s+`), '');
  }
  return text.trim();
}

function stripTags(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
