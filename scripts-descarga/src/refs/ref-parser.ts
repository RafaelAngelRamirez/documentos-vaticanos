/**
 * Offline biblical reference parser for CCC Spanish citations.
 * Does not touch the network; resolves abbreviations via book-codes index.
 */

export interface BookCodeEntry {
  bookSlug: string;
  bookCode: string;
  aliases: string[];
  testament: "ot" | "nt" | string;
}

export interface BibleCitation {
  raw: string;
  bookCode: string;
  bookSlug: string;
  /** 0 = unknown / single-chapter book stored as ch.0 in corpus */
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  /** Explicit verse list e.g. 4.10.12 */
  verses?: number[];
  cf: boolean;
  /** True when citation is chapter-only (e.g. "Jc 13") */
  chapterOnly?: boolean;
  /** True when a single number was treated as verse for a single-chapter book */
  verseOnly?: boolean;
}

export type ParsedAtom =
  | { kind: "bible"; raw: string; citation: BibleCitation }
  | { kind: "noise"; raw: string }
  | { kind: "unresolved"; raw: string };

export type BookIndex = Map<string, BookCodeEntry>;

/** Single-chapter books often stored as capitulo "0" in this corpus. */
export const SINGLE_CHAPTER_SLUGS = new Set([
  "abdias",
  "carta a filemon",
  "carta de jeremias",
  "carta de san judas",
  "segunda carta de san juan",
  "tercera carta de san juan",
]);

/**
 * CCC magisterial / legal codes often written ALL CAPS and collide with bible
 * abbreviations when lowercased (CT→Ct, AG→Ag, RM→Rm, MC→Mc, NA→Na, …).
 * Only rejected when the source token is fully uppercase (no lowercase letters).
 */
export const DOCUMENT_BLOCKLIST = new Set(
  [
    "LG", "GS", "SC", "DV", "AA", "AG", "CD", "OT", "PC", "PO", "UR", "NA",
    "DH", "GE", "IM", "CT", "EN", "RM", "CA", "FC", "CL", "VS", "EV", "LE",
    "SRS", "RP", "MD", "MC", "HV", "PT", "MF", "OE", "PG", "MM", "CIC", "CCEO",
    "DS", "RH", "PP", "DCG", "DeV", "ChL", "TMA", "NMI", "EE", "SA", "PDV",
    "RMi", "CT", "CAN",
  ].map((s) => s.toUpperCase()),
);


const NOISE_EXACT = new Set(
  [
    "primera parte",
    "segunda parte",
    "tercera parte",
    "cuarta parte",
    "primera sección",
    "segunda sección",
    "tercera sección",
    "cuarta sección",
    "primera seccion",
    "segunda seccion",
    "tercera seccion",
    "cuarta seccion",
    "capítulo primero",
    "capítulo segundo",
    "capítulo tercero",
    "capitulo primero",
    "capitulo segundo",
    "capitulo tercero",
    "el símbolo",
    "el simbolo",
    "los mandamientos",
    "el padre nuestro",
    "mediante cf.",
    "mediante cf",
    "ibíd.",
    "ibid.",
    "ibid",
    "ibíd",
  ].map((s) => normalizeForNoise(s)),
);

const NOISE_PREFIXES = [
  "san agustín",
  "san agustin",
  "santo tomás",
  "santo tomas",
  "san tomás",
  "san tomas",
  "san juan de la cruz",
  "concilio ",
  "juan pablo",
  "pío ",
  "pio ",
  "pablo vi",
  "catecismo romano",
  "sínodo",
  "sinodo",
  "discurso ",
  "relación final",
  "relacion final",
  "liturgia ",
  "plegaria ",
  "misal romano",
  "adversus ",
  "epistula",
  "oratio",
  "sermo",
  "didach",
];

/**
 * Lowercase, strip diacritics / dots / spaces for abbreviation lookup.
 * Keeps digits (for 1Tm, 2Co, …).
 */
export function normalizeAbbr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\u00b7]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeForNoise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build alias → book entry map. Longer / more specific aliases win on collision
 * only if the existing entry is a greek-supplement secondary; otherwise first
 * primary entry registered for an alias is kept.
 */
export function buildBookIndex(books: BookCodeEntry[]): BookIndex {
  const index: BookIndex = new Map();
  // Register primary books first, then supplements (weaker aliases only).
  const sorted = [...books].sort((a, b) => {
    const aSup = /suplementos/.test(a.bookSlug) ? 1 : 0;
    const bSup = /suplementos/.test(b.bookSlug) ? 1 : 0;
    return aSup - bSup;
  });

  for (const book of sorted) {
    const keys = new Set<string>();
    keys.add(normalizeAbbr(book.bookCode));
    keys.add(normalizeAbbr(book.bookSlug));
    for (const alias of book.aliases) {
      keys.add(normalizeAbbr(alias));
    }
    for (const key of keys) {
      if (!key) continue;
      if (!index.has(key)) {
        index.set(key, book);
      }
    }
  }
  return index;
}

/**
 * Split a raw ref.descripcion on `;`, strip leading cf. markers for grouping,
 * and drop empty pieces. Keeps original atom text (with cf. if present).
 */
export function atomizeRefGroup(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Pure years, section labels, and other non-biblical footnote noise. */
export function isNoise(atom: string): boolean {
  const t = atom.trim();
  if (!t) return true;

  // Pure year (optionally with trailing punctuation)
  if (/^\d{3,4}\.?$/.test(t)) return true;

  // Bare small integers that are footnote markers, not citations
  if (/^\d{1,2}$/.test(t)) return true;

  const n = normalizeForNoise(t);
  if (NOISE_EXACT.has(n)) return true;

  for (const p of NOISE_PREFIXES) {
    if (n.startsWith(p)) return true;
  }

  // Long prose without a clear "Book chapter" pattern
  if (t.length > 80 && !/\b[1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúñÑ.]{1,12}\s+\d/.test(t)) {
    return true;
  }

  return false;
}

interface VerseExpr {
  verseStart: number;
  verseEnd?: number;
  verses?: number[];
}

/** Parse "32", "3-4", "26-28", "4.10.12", "2.39", "1. 12-13" */
function parseVerseExpression(expr: string): VerseExpr | null {
  const cleaned = expr
    .replace(/\[.*?\]/g, "") // drop [LXX] etc.
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  // List: 4.10.12 or 1. 12-13 (mixed — take numeric tokens)
  if (cleaned.includes(".")) {
    const parts = cleaned.split(".").map((p) => p.trim()).filter(Boolean);
    const verses: number[] = [];
    for (const part of parts) {
      const range = part.match(/^(\d+)\s*[-–—]\s*(\d+)/);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (!Number.isNaN(a)) verses.push(a);
        // only record start of sub-range for primary target
        void b;
      } else {
        const m = part.match(/^(\d+)/);
        if (m) verses.push(parseInt(m[1], 10));
      }
    }
    if (verses.length === 0) return null;
    return { verseStart: verses[0], verses };
  }

  const range = cleaned.match(/^(\d+)\s*[-–—]\s*(\d+)/);
  if (range) {
    return {
      verseStart: parseInt(range[1], 10),
      verseEnd: parseInt(range[2], 10),
    };
  }

  const single = cleaned.match(/^(\d+)/);
  if (single) {
    return { verseStart: parseInt(single[1], 10) };
  }
  return null;
}

/**
 * Strip trailing prose after a citation: ", donde los ángeles…", " [LXX]", etc.
 * Keeps the core "Book ch,verses" region.
 */
function stripTrailingProse(atom: string): string {
  let s = atom.trim();
  // Remove bracketed notes
  s = s.replace(/\s*\[.*?\]\s*/g, " ").trim();
  // If there's a comma followed by lowercase prose (not a verse list), cut it
  // e.g. "Jb 38, 7, donde los ángeles…"
  s = s.replace(/,\s+(?=[a-záéíóúñ])/i, " § ").split(" § ")[0].trim();
  // "cf. también …" leftovers after book-less atoms are handled elsewhere
  s = s.replace(/\s+cf\.?\s+también.*$/i, "").trim();
  s = s.replace(/\s+donde\b.*$/i, "").trim();
  return s;
}

/**
 * Parse a single citation atom into a BibleCitation, or null if not biblical.
 * @param defaultBook carry-forward book from previous atom (e.g. "12,2" after "Hb 11,40")
 */
export function parseBibleCitation(
  atom: string,
  bookIndex: BookIndex,
  defaultBook?: BookCodeEntry | null,
): BibleCitation | null {
  let raw = atom.trim();
  if (!raw) return null;

  let cf = false;
  // Leading cf. / cf / véase
  const cfMatch = raw.match(/^(?:cf\.?|véase|vease)\s+/i);
  if (cfMatch) {
    cf = true;
    raw = raw.slice(cfMatch[0].length).trim();
  }
  // "también " after cf.
  raw = raw.replace(/^también\s+/i, "").trim();

  raw = stripTrailingProse(raw);
  if (!raw) return null;

  // Pattern A: Book + chapter[, verses]
  // Book: optional 1-3, optional spaces, letters (with accents/dots)
  // e.g. Mt 10,32 | 1 Tm 2,3-4 | 1Tm 2,3-4 | Rm 10,9 | Judas 3
  const withBook =
    /^(?<book>\d{0,1}\s*[A-Za-zÁÉÍÓÚáéíóúÜüñÑ.]{1,20})\s+(?<rest>.+)$/u;
  // Pattern B: chapter-only continuation "12,2" or "146,3-4" or "10,1"
  const chapterOnlyCont =
    /^(?<chapter>\d{1,3})\s*[,:]\s*(?<verses>[\d.\-\s–—]+)$/;
  // Pattern C: bare chapter continuation "3-4,11" (rare Hb 3-4,11) — treat first as chapter
  const chapterRange =
    /^(?<c1>\d{1,3})\s*[-–—]\s*(?<c2>\d{1,3})\s*[,:]\s*(?<verses>[\d.\-\s–—]+)$/;

  let bookEntry: BookCodeEntry | null = null;
  let rest: string | null = null;

  const mBook = raw.match(withBook);
  if (mBook?.groups) {
    const bookRaw = mBook.groups.book.trim();
    // ALL-CAPS tokens that are known magisterial docs (CT, AG, RM, MC, …)
    const lettersOnly = bookRaw.replace(/[^A-Za-zÁÉÍÓÚáéíóúÜüñÑ]/gu, "");
    const isAllCapsDoc =
      lettersOnly.length >= 2 &&
      lettersOnly === lettersOnly.toUpperCase() &&
      DOCUMENT_BLOCKLIST.has(lettersOnly.toUpperCase());
    if (!isAllCapsDoc) {
      const key = normalizeAbbr(bookRaw);
      bookEntry = bookIndex.get(key) ?? null;
      if (bookEntry) {
        rest = mBook.groups.rest.trim();
      }
    }
  }

  // Continuation without book name
  if (!bookEntry && defaultBook) {
    if (chapterOnlyCont.test(raw) || chapterRange.test(raw) || /^\d{1,3}$/.test(raw)) {
      bookEntry = defaultBook;
      rest = raw;
    }
  }

  if (!bookEntry || rest === null) {
    return null;
  }

  // Chapter range with verse: "3-4,11" → chapter 3, verse 11
  const mRange = rest.match(chapterRange);
  if (mRange?.groups) {
    const chapter = parseInt(mRange.groups.c1, 10);
    const ve = parseVerseExpression(mRange.groups.verses);
    if (!ve) return null;
    return {
      raw: atom.trim(),
      bookCode: bookEntry.bookCode,
      bookSlug: bookEntry.bookSlug,
      chapter,
      verseStart: ve.verseStart,
      verseEnd: ve.verseEnd,
      verses: ve.verses,
      cf,
    };
  }

  // "10,32" / "10:32" / "10, 32" / "10,3-4" / "10,4.10.12"
  const mChV = rest.match(
    /^(?<chapter>\d{1,3})\s*[,:]\s*(?<verses>[\d.\-\s–—]+)/,
  );
  if (mChV?.groups) {
    const chapter = parseInt(mChV.groups.chapter, 10);
    const ve = parseVerseExpression(mChV.groups.verses);
    if (!ve) return null;
    return {
      raw: atom.trim(),
      bookCode: bookEntry.bookCode,
      bookSlug: bookEntry.bookSlug,
      chapter,
      verseStart: ve.verseStart,
      verseEnd: ve.verseEnd,
      verses: ve.verses,
      cf,
    };
  }

  // Chapter range without verse: "Mt 5-6" / "1 Co 1-6"
  const mChRangeOnly = rest.match(
    /^(?<c1>\d{1,3})\s*[-–—]\s*(?<c2>\d{1,3})\s*\.?$/,
  );
  if (mChRangeOnly?.groups) {
    const chapter = parseInt(mChRangeOnly.groups.c1, 10);
    return {
      raw: atom.trim(),
      bookCode: bookEntry.bookCode,
      bookSlug: bookEntry.bookSlug,
      chapter,
      verseStart: 1,
      cf,
      chapterOnly: true,
    };
  }

  // Chapter only: "Jc 13" or continuation "13"
  const mChOnly = rest.match(/^(?<chapter>\d{1,3})\s*\.?$/);
  if (mChOnly?.groups) {
    const n = parseInt(mChOnly.groups.chapter, 10);
    if (SINGLE_CHAPTER_SLUGS.has(bookEntry.bookSlug)) {
      // "Judas 3" → verse 3 of the single chapter
      return {
        raw: atom.trim(),
        bookCode: bookEntry.bookCode,
        bookSlug: bookEntry.bookSlug,
        chapter: 0,
        verseStart: n,
        cf,
        verseOnly: true,
      };
    }
    return {
      raw: atom.trim(),
      bookCode: bookEntry.bookCode,
      bookSlug: bookEntry.bookSlug,
      chapter: n,
      verseStart: 1,
      cf,
      chapterOnly: true,
    };
  }

  return null;
}

/**
 * Parse a full ref.descripcion into typed atoms, carrying book context across `;`.
 */
export function parseRefGroup(raw: string, bookIndex: BookIndex): ParsedAtom[] {
  const atoms = atomizeRefGroup(raw);
  const out: ParsedAtom[] = [];
  let lastBook: BookCodeEntry | null = null;

  for (const atom of atoms) {
    if (isNoise(atom)) {
      out.push({ kind: "noise", raw: atom });
      continue;
    }

    const citation = parseBibleCitation(atom, bookIndex, lastBook);
    if (citation) {
      lastBook = {
        bookSlug: citation.bookSlug,
        bookCode: citation.bookCode,
        aliases: [],
        testament: "",
      };
      // Prefer full entry from index for slug fidelity
      const full = bookIndex.get(normalizeAbbr(citation.bookCode));
      if (full) lastBook = full;

      out.push({ kind: "bible", raw: atom, citation });
    } else {
      out.push({ kind: "unresolved", raw: atom });
    }
  }

  return out;
}
