/**
 * Parse El Libro del Pueblo de Dios chapter HTML (vatican.va ESL0506).
 *
 * Psalm pages split each verse across several `p.MsoNormal` nodes. A new verse
 * starts only when the paragraph begins with digits + whitespace (`1 El…`).
 * Letter-suffix lines (`16c y me…`) stay glued to the previous verse — they are
 * not a new `parseInt` hit.
 */

export interface ParsedVerse {
  versiculo: number;
  contenido: string;
}

/** Verse opener: leading 1–3 digits, then whitespace, then non-space. */
const VERSE_START_RE = /^(\d{1,3})\s+\S/;

export function cleanSpecialCharacters(texto: string): string {
  return (texto || "").replace(/\s+/g, " ").trim();
}

/**
 * True when `contenido` opens a numbered verse (not `16c…`, not bare prose).
 */
export function isVerseStart(contenido: string): number | null {
  const t = cleanSpecialCharacters(contenido);
  const m = t.match(VERSE_START_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fold `p.MsoNormal` texts into verses. Continuation lines append to the last
 * verse. Leading non-verse lines before the first number are dropped.
 */
export function foldPsalmParagraphs(paragraphs: string[]): ParsedVerse[] {
  const verses: ParsedVerse[] = [];
  for (const raw of paragraphs) {
    const contenido = cleanSpecialCharacters(raw);
    if (!contenido) continue;
    const num = isVerseStart(contenido);
    if (num == null) {
      if (verses.length === 0) continue;
      const prev = verses[verses.length - 1];
      prev.contenido = cleanSpecialCharacters(`${prev.contenido} ${contenido}`);
      continue;
    }
    verses.push({ versiculo: num, contenido });
  }
  return verses;
}

/**
 * Collect `p.MsoNormal` textContent values from a linkedom/DOM document.
 */
export function msoNormalTexts(document: {
  querySelectorAll: (sel: string) => ArrayLike<{ textContent?: string | null }>;
}): string[] {
  return Array.from(document.querySelectorAll("p.MsoNormal")).map((p) =>
    cleanSpecialCharacters(p.textContent ?? ""),
  );
}

export function parsePsalmChapterDocument(document: {
  querySelectorAll: (sel: string) => ArrayLike<{ textContent?: string | null }>;
}): ParsedVerse[] {
  return foldPsalmParagraphs(msoNormalTexts(document));
}
