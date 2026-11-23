/**
 * Build document navigation TOC (Índice) from corpus units.
 * Pure helpers — no Angular / HTTP dependency.
 *
 * Sources (in priority order for each document):
 * 1. Bible book boundaries (`biblia.libro` first occurrence).
 * 2. Structural headings in body (reuse speech-prep headingLevel).
 * 3. Optional curated overrides only when auto detection is empty.
 *
 * Entries always target a stable unitIndex (array index in content.json).
 */

import {
  headingLevel,
  isSpeakHostileJunk,
  normalizeSpeakText,
  type HeadingLevel,
} from './speech-prep.logic';

/** One row in the document-detail `.toc` list. */
export interface TocEntry {
  /** Short label shown in `.tnum` (roman, book abbrev, or "—"). */
  num: string;
  /** Human title / book name. */
  title: string;
  /** Stable unit index in the document body (`documentId` + unitIndex). */
  unitIndex: number;
  /** Structural level when known (1 major … 3 minor); omitted for bible books. */
  level?: HeadingLevel;
}

/** Minimal unit shape accepted by the builder (corpus Article-compatible). */
export interface TocUnit {
  contenido?: string;
  consecutivo?: string;
  index_array?: number;
  biblia?: {
    libro?: string;
    consecutivo_versiculo?: string;
    capitulo?: string;
  };
}

export interface BuildDocumentTocOptions {
  documentId?: string;
  /** Corpus meta.kind (`bible`, `catechism`, …). */
  kind?: string;
  /** Cap length of the index (default 80). */
  maxEntries?: number;
  /**
   * Minimum heading level to include (1=PARTE only … 3=include ARTÍCULO).
   * Default: auto — prefer 1–2, fall back to 3 when sparse.
   */
  minHeadingLevel?: HeadingLevel;
  /**
   * Curated landmarks for this document. Used only when automatic
   * detection yields no entries (override, not sole corpus source).
   */
  curated?: TocEntry[];
}

/**
 * Amoris laetitia — 325 numbered paragraphs, no chapter headings in the
 * packed body (EN or ES). Landmarks follow the official chapter starts;
 * unitIndex = consecutivo − 1.
 */
const AMORIS_LAETITIA_TOC_ES: TocEntry[] = [
  { num: '—', title: 'Introducción', unitIndex: 0 },
  { num: 'I', title: 'A la luz de la Palabra', unitIndex: 7 },
  { num: 'II', title: 'La realidad y los desafíos de las familias', unitIndex: 30 },
  { num: 'III', title: 'La mirada puesta en Jesús: vocación de la familia', unitIndex: 57 },
  { num: 'IV', title: 'El amor en el matrimonio', unitIndex: 88 },
  { num: 'V', title: 'Amor que se vuelve fecundo', unitIndex: 119 },
  { num: 'VI', title: 'Algunas perspectivas pastorales', unitIndex: 198 },
  { num: 'VII', title: 'Fortalecer la educación de los hijos', unitIndex: 259 },
  { num: 'VIII', title: 'Acompañar, discernir e integrar la fragilidad', unitIndex: 290 },
  { num: 'IX', title: 'Espiritualidad matrimonial y familiar', unitIndex: 312 },
];

const AMORIS_LAETITIA_TOC_EN: TocEntry[] = [
  { num: '—', title: 'Introduction', unitIndex: 0 },
  { num: 'I', title: 'In the light of the Word', unitIndex: 7 },
  { num: 'II', title: 'The experiences and challenges of families', unitIndex: 30 },
  { num: 'III', title: 'Looking to Jesus: the vocation of the family', unitIndex: 57 },
  { num: 'IV', title: 'Love in marriage', unitIndex: 88 },
  { num: 'V', title: 'Love made fruitful', unitIndex: 119 },
  { num: 'VI', title: 'Some pastoral perspectives', unitIndex: 198 },
  { num: 'VII', title: 'Towards a better education of children', unitIndex: 259 },
  { num: 'VIII', title: 'Accompanying, discerning and integrating weakness', unitIndex: 290 },
  { num: 'IX', title: 'The spirituality of marriage and the family', unitIndex: 312 },
];

/** Small curated maps for high-value packs whose units lack heading text. */
export const CURATED_TOC_OVERRIDES: Record<string, TocEntry[]> = {
  // Dei Verbum — chapters are editorial, not unit titles in content.
  'dv-es': [
    { num: 'I', title: 'La revelación misma', unitIndex: 0 },
    {
      num: 'II',
      title: 'La transmisión de la revelación divina',
      unitIndex: 6,
    },
    {
      num: 'III',
      title: 'La inspiración e interpretación de la Sagrada Escritura',
      unitIndex: 10,
    },
    { num: 'IV', title: 'El Antiguo Testamento', unitIndex: 13 },
    { num: 'V', title: 'El Nuevo Testamento', unitIndex: 16 },
    {
      num: 'VI',
      title: 'La Sagrada Escritura en la vida de la Iglesia',
      unitIndex: 20,
    },
  ],
  'esortazione-ap-20160319-amoris-laetitia-es': AMORIS_LAETITIA_TOC_ES,
  'esortazione-ap-20160319-amoris-laetitia-en': AMORIS_LAETITIA_TOC_EN,
};

const DEFAULT_MAX = 80;

/** Normalize heading text for dedupe (running headers in CIC, etc.). */
export function normalizeTocLabel(raw: string): string {
  return normalizeSpeakText(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents for matching
    .replace(/[«»"'“”]/g, '')
    .replace(/[:;.,·—–\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a bible `libro` slug / phrase for UI (e.g. "primer libro de samuel").
 */
export function formatBibleBookTitle(libro: string): string {
  const raw = String(libro || '').trim();
  if (!raw) return '';
  const small = new Set([
    'a',
    'al',
    'con',
    'de',
    'del',
    'e',
    'el',
    'en',
    'la',
    'las',
    'los',
    'o',
    'para',
    'por',
    'san',
    'santa',
    'un',
    'una',
    'y',
  ]);
  return raw
    .split(/\s+/)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      // Accent-friendly capitalize
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Short num for a bible book from `consecutivo_versiculo` (e.g. "Gn 1, 1" → "Gn").
 */
export function bibleBookNum(
  unit: TocUnit,
  libro: string,
  ordinal: number,
): string {
  const v = unit.biblia?.consecutivo_versiculo?.trim() || '';
  // "1 S 0, 0" / "Gn 1, 1" / "1 Jn 2, 1"
  const m = v.match(/^(\d+\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+|[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+)/);
  if (m) return m[1].replace(/\.$/, '').trim();
  // Fallback: first letters of significant words
  const words = formatBibleBookTitle(libro).split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3);
  return String(ordinal + 1);
}

/**
 * Split a structural heading into { num, title } for `.toc` display.
 */
export function formatHeadingEntry(
  raw: string,
  fallbackOrdinal: number,
): { num: string; title: string } {
  const t = normalizeSpeakText(raw);
  if (!t) return { num: '—', title: `§ ${fallbackOrdinal + 1}` };

  // "CAPÍTULO PRIMERO: …" / "CAPÍTULO I …" / "Primera parte: …"
  const cap = t.match(
    /^(?:cap[ií]tulo|art[ií]culo|secci[oó]n|t[ií]tulo|parte|libro)\s+([ivxlcdm]+|\d+|primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta)[:.\s]+(.+)$/i,
  );
  if (cap) {
    return {
      num: romanizeToken(cap[1]),
      title: softTitle(cap[2]),
    };
  }

  // "PRIMERA PARTE LA PROFESIÓN…" / "Primera parte: la profesión…"
  const parte = t.match(
    /^(?:la\s+)?(primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima|\d+)\s+parte\b[:\s]*(.*)$/i,
  );
  if (parte) {
    return {
      num: romanizeToken(parte[1]),
      title: softTitle(parte[2] || t),
    };
  }

  // "I. Introducción" / "1. Introducción"
  const numbered = t.match(/^([ivxlcdm]+|\d+)[.):]\s+(.+)$/i);
  if (numbered) {
    return { num: romanizeToken(numbered[1]), title: softTitle(numbered[2]) };
  }

  // "PRÓLOGO" / short ALL-CAPS
  if (t.length <= 40 && !/[.!?].+[.!?]/.test(t)) {
    return { num: '—', title: softTitle(t) };
  }

  return { num: '—', title: softTitle(t) };
}

function romanizeToken(token: string): string {
  const t = token.trim().toLowerCase();
  const map: Record<string, string> = {
    primera: 'I',
    primero: 'I',
    segunda: 'II',
    segundo: 'II',
    tercera: 'III',
    tercero: 'III',
    cuarta: 'IV',
    cuarto: 'IV',
    quinta: 'V',
    quinto: 'V',
    sexta: 'VI',
    sexto: 'VI',
    séptima: 'VII',
    septima: 'VII',
    séptimo: 'VII',
    septimo: 'VII',
    octava: 'VIII',
    octavo: 'VIII',
    novena: 'IX',
    noveno: 'IX',
    décima: 'X',
    decima: 'X',
    décimo: 'X',
    decimo: 'X',
  };
  if (map[t]) return map[t];
  if (/^\d+$/.test(t)) return t;
  if (/^[ivxlcdm]+$/i.test(t)) return t.toUpperCase();
  return token.trim().slice(0, 6).toUpperCase();
}

function softTitle(s: string): string {
  const t = normalizeSpeakText(s);
  if (!t) return '';
  // Keep reasonable length for TOC rows
  if (t.length > 90) return t.slice(0, 87).trimEnd() + '…';
  return t;
}

function unitIndexOf(unit: TocUnit, arrayIndex: number): number {
  if (typeof unit.index_array === 'number' && unit.index_array >= 0) {
    return unit.index_array;
  }
  return arrayIndex;
}

/** Filter OCR / spacing garbage that headingLevel still accepts as short titles. */
function looksLikeOcrHeadingNoise(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return true;
  // "C A P. 2 0" / "D E L DON" letter-spacing soup (single letters separated by space)
  const spacedSingles = (
    t.match(/(?:^|[\s«»"'()])([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\s+(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b)/g) ||
    []
  ).length;
  if (spacedSingles >= 2) return true;
  // "« . Confesiones" / nested junk punctuation
  if (/[«»]\s*[.(]/.test(t) || /\(\s*\(/.test(t)) return true;
  // Heavy garbage punctuation clusters
  if ((t.match(/[«»"'().]/g) || []).length >= 6 && t.length < 80) return true;
  // Mostly non-letters
  const letters = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  if (letters < 4) return true;
  if (letters / Math.max(t.length, 1) < 0.35 && t.length > 20) return true;
  return false;
}

function hasBibleBooks(units: TocUnit[]): boolean {
  for (let i = 0; i < Math.min(units.length, 50); i++) {
    if (units[i]?.biblia?.libro) return true;
  }
  // Sparse check further in for safety
  for (let i = 50; i < units.length; i += Math.max(1, Math.floor(units.length / 20))) {
    if (units[i]?.biblia?.libro) return true;
  }
  return false;
}

/**
 * Bible TOC: one entry per book at its first unit occurrence.
 */
export function buildBibleBookToc(units: TocUnit[]): TocEntry[] {
  const seen = new Set<string>();
  const out: TocEntry[] = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const libro = (u?.biblia?.libro || '').trim();
    if (!libro) continue;
    const key = libro.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const title = formatBibleBookTitle(libro);
    out.push({
      num: bibleBookNum(u, libro, out.length),
      title,
      unitIndex: unitIndexOf(u, i),
    });
  }
  return out;
}

/**
 * Compact cite-map shape (libro → capítulo → versículo → unitIndex).
 * Kept local so this module stays free of Angular / HTTP imports.
 */
export interface TocCiteMap {
  books: Record<string, Record<string, Record<string, number>>>;
}

/**
 * Bible TOC from a cite-map when the packed body dropped `biblia`
 * (English Pueblo de Dios and siblings). Same unit indexes as ES.
 */
export function buildBibleTocFromCiteMap(
  map: TocCiteMap | null | undefined,
  opts?: { maxEntries?: number },
): TocEntry[] {
  const books = map?.books;
  if (!books || typeof books !== 'object') return [];
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX;
  const out: TocEntry[] = [];
  for (const [libro, chapters] of Object.entries(books)) {
    if (!libro || !chapters || typeof chapters !== 'object') continue;
    let start = Number.POSITIVE_INFINITY;
    for (const verses of Object.values(chapters)) {
      if (!verses || typeof verses !== 'object') continue;
      for (const idx of Object.values(verses)) {
        if (typeof idx === 'number' && Number.isInteger(idx) && idx >= 0) {
          if (idx < start) start = idx;
        }
      }
    }
    if (!Number.isFinite(start)) continue;
    const title = formatBibleBookTitle(libro);
    out.push({
      num: bibleBookNum(
        { biblia: { libro, consecutivo_versiculo: '' } },
        libro,
        out.length,
      ),
      title,
      unitIndex: start,
    });
    if (out.length >= maxEntries) break;
  }
  return out;
}

/**
 * Reader / cover label for a unit. Skips bare «0» and bible title rows
 * (`capitulo`/`versiculo` 0 → book abbrev only).
 */
export function unitDisplayLabel(
  unit: TocUnit | null | undefined,
  fallbackIndex?: number,
): string {
  if (!unit) {
    return typeof fallbackIndex === 'number' && fallbackIndex >= 0
      ? String(fallbackIndex + 1)
      : '';
  }
  const b = unit.biblia;
  if (b?.libro) {
    const cap = String(b.capitulo ?? '').trim();
    const verseNum =
      typeof (b as { versiculo?: number }).versiculo === 'number'
        ? (b as { versiculo?: number }).versiculo
        : Number.NaN;
    const isTitle =
      cap === '0' ||
      verseNum === 0 ||
      /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]+\s+0,\s*0$/.test(
        (b.consecutivo_versiculo || '').trim(),
      );
    if (isTitle) {
      return bibleBookNum(unit, b.libro, 0);
    }
    if (b.consecutivo_versiculo?.trim()) {
      return b.consecutivo_versiculo.trim();
    }
  }
  const raw = (unit.consecutivo ?? '').trim();
  if (raw && raw !== 'no-encontrado' && raw !== '0') return raw;
  if (typeof fallbackIndex === 'number' && fallbackIndex >= 0) {
    return String(fallbackIndex + 1);
  }
  if (typeof unit.index_array === 'number' && unit.index_array >= 0) {
    return String(unit.index_array + 1);
  }
  return '';
}

/**
 * Structural-heading TOC with running-header dedupe.
 * Prefer major landmarks (level 1–2); include level 3 only when sparse.
 */
export function buildHeadingToc(
  units: TocUnit[],
  opts?: { maxEntries?: number; minHeadingLevel?: HeadingLevel },
): TocEntry[] {
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX;
  const forcedMin = opts?.minHeadingLevel;

  type Cand = {
    unitIndex: number;
    level: HeadingLevel;
    raw: string;
    key: string;
  };
  const cands: Cand[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const raw = u?.contenido ?? '';
    if (isSpeakHostileJunk(raw)) continue;
    const level = headingLevel(raw, { consecutivo: u?.consecutivo });
    if (level === 0) continue;
    if (forcedMin && level > forcedMin) continue;
    const cleaned = normalizeSpeakText(raw);
    // Skip OCR-garbled short "headings" (spaced letters, junk punctuation)
    if (looksLikeOcrHeadingNoise(cleaned)) continue;
    const key = normalizeTocLabel(raw);
    if (!key || key.length < 3) continue;
    // Dedupe running headers (CIC repeats PART/SECTION lines constantly)
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    cands.push({
      unitIndex: unitIndexOf(u, i),
      level,
      raw: cleaned,
      key,
    });
  }

  if (cands.length === 0) return [];

  const pick = (minLevel: HeadingLevel): TocEntry[] => {
    const filtered = cands.filter((c) => c.level <= minLevel && c.level >= 1);
    return filtered.slice(0, maxEntries).map((c, idx) => {
      const { num, title } = formatHeadingEntry(c.raw, idx);
      return {
        num,
        title: title || c.raw.slice(0, 80),
        unitIndex: c.unitIndex,
        level: c.level,
      };
    });
  };

  if (forcedMin) return pick(forcedMin);

  // Auto: try major only (1), then 1–2, then all — aim for useful density
  let entries = pick(1);
  if (entries.length >= 2 && entries.length <= maxEntries) {
    // If only a couple of major parts, enrich with sections/chapters
    if (entries.length < 8) {
      const withMid = pick(2);
      if (withMid.length > entries.length && withMid.length <= maxEntries) {
        entries = withMid;
      }
    }
    return entries;
  }
  entries = pick(2);
  if (entries.length >= 1) return entries;
  return pick(3);
}

function clampCurated(
  curated: TocEntry[],
  unitCount: number,
): TocEntry[] {
  return curated
    .filter(
      (e) =>
        typeof e.unitIndex === 'number' &&
        e.unitIndex >= 0 &&
        (unitCount <= 0 || e.unitIndex < unitCount) &&
        (e.title || e.num),
    )
    .map((e) => ({
      num: e.num || '—',
      title: e.title || `Unidad ${e.unitIndex + 1}`,
      unitIndex: e.unitIndex,
      level: e.level,
    }));
}

/**
 * Build navigation TOC for a document body.
 * Offline-safe: pure function over units already loaded from the pack.
 */
export function buildDocumentToc(
  units: TocUnit[] | null | undefined,
  opts?: BuildDocumentTocOptions,
): TocEntry[] {
  const list = Array.isArray(units) ? units : [];
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX;
  const kind = (opts?.kind || '').toLowerCase();
  const docId = opts?.documentId || '';

  if (list.length === 0) {
    const curated =
      opts?.curated ??
      (docId ? CURATED_TOC_OVERRIDES[docId] : undefined);
    return curated ? clampCurated(curated, 0) : [];
  }

  // 1) Bible book boundaries
  if (kind === 'bible' || hasBibleBooks(list)) {
    const books = buildBibleBookToc(list);
    if (books.length > 0) return books.slice(0, maxEntries);
  }

  // 2) Structural headings from content
  const headings = buildHeadingToc(list, {
    maxEntries,
    minHeadingLevel: opts?.minHeadingLevel,
  });
  if (headings.length > 0) return headings;

  // 3) Curated override only when auto is empty
  const curated =
    opts?.curated ??
    (docId ? CURATED_TOC_OVERRIDES[docId] : undefined);
  if (curated?.length) return clampCurated(curated, list.length);

  return [];
}
