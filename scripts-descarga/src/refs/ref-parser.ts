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

export interface EcclesialCitation {
  raw: string;
  /** Canonical code e.g. LG, CIC, DS */
  code: string;
  /** Section / paragraph / number when present */
  locator: string | null;
  /** Optional secondary range end */
  locatorEnd?: string;
  cf: boolean;
  title?: string;
  /** Target corpus id when known and present in pack */
  corpusDocId?: string | null;
  locatorType?: "number" | "bible" | "free" | string;
}

export type ParsedAtom =
  | { kind: "bible"; raw: string; citation: BibleCitation }
  | { kind: "ecclesial"; raw: string; citation: EcclesialCitation }
  | { kind: "noise"; raw: string }
  | { kind: "unresolved"; raw: string };

export type BookIndex = Map<string, BookCodeEntry>;

export interface DocCodeEntry {
  code: string;
  aliases: string[];
  title: string;
  corpusDocId: string | null;
  locatorType: "number" | "bible" | "free" | string;
  kind: string;
}

export type DocIndex = Map<string, DocCodeEntry>;

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
 * @deprecated Prefer doc-codes.json + parseEcclesialCitation.
 * Kept for tests that still reference the old name; ALL-CAPS magisterial
 * tokens are now parsed as ecclesial, not discarded.
 */
export const DOCUMENT_BLOCKLIST = new Set(
  [
    "LG", "GS", "SC", "DV", "AA", "AG", "CD", "OT", "PC", "PO", "UR", "NA",
    "DH", "GE", "IM", "CT", "EN", "RM", "CA", "FC", "CL", "VS", "EV", "LE",
    "SRS", "RP", "MD", "MC", "HV", "PT", "MF", "OE", "PG", "MM", "CIC", "CCEO",
    "CDS", "CDC", "CICL", "CDSI",
    "DS", "RH", "PP", "DCG", "DeV", "ChL", "TMA", "NMI", "EE", "SA", "PDV",
    "RMi", "CT", "CAN",
    "LS", "FT", "DCE", "LF", "EG", "AL", "SPS", "CIV", "SCA", "VD",
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
 * Build alias → ecclesial document entry.
 * Keys: uppercase code, normalized alias (no diacritics/spaces).
 */
export function buildDocIndex(docs: DocCodeEntry[]): DocIndex {
  const index: DocIndex = new Map();
  for (const doc of docs) {
    const keys = new Set<string>();
    keys.add(doc.code.toUpperCase());
    keys.add(normalizeAbbr(doc.code));
    for (const alias of doc.aliases ?? []) {
      keys.add(alias.toUpperCase());
      keys.add(normalizeAbbr(alias));
    }
    for (const key of keys) {
      if (!key) continue;
      if (!index.has(key)) index.set(key, doc);
    }
  }
  return index;
}

/**
 * Whether a code token should be treated as an ecclesial abbreviation.
 * Short mixed-case tokens like "Mc", "Rm", "Ct" are biblical; CCC uses
 * ALL-CAPS for magisterial docs (LG, GS, CT, MC, RM…). Longer aliases
 * ("Lumen gentium", "Catechesi tradendae") are always ecclesial.
 */
function isEcclesialTokenForm(token: string): boolean {
  const letters = token.replace(/[^A-Za-zÁÉÍÓÚáéíóúÜüñÑ]/gu, "");
  if (letters.length >= 2 && letters === letters.toUpperCase()) return true;
  // Multi-word / long titles
  if (/\s/.test(token) || token.length > 4) return true;
  // Explicit long codes even if mixed (CIC, CCEO, CCEO)
  const upper = letters.toUpperCase();
  if (upper === "CIC" || upper === "CCEO" || upper === "DS") return true;
  // Mixed-case magisterial tokens already in doc-codes (DeV, DonV, RMi, ChL,
  // SpS, CiV, SCa). Never list DN here: mixed "Dn" is biblical Daniel.
  if (
    upper === "DEV" ||
    upper === "DONV" ||
    upper === "DONVER" ||
    upper === "RMI" ||
    upper === "CHL" ||
    upper === "SPS" ||
    upper === "CIV" ||
    upper === "SCA"
  ) {
    return true;
  }
  return false;
}

/**
 * Parse magisterial / CIC-style citations: "LG 16", "cf. CIC 1992", "DS 3004",
 * "CT 20-22", "CIC 27". Does NOT claim "Mc 16,20" (Marcos) as Marialis cultus.
 */
export function parseEcclesialCitation(
  atom: string,
  docIndex: DocIndex,
): EcclesialCitation | null {
  let raw = atom.trim();
  if (!raw) return null;

  let cf = false;
  const cfMatch = raw.match(/^(?:cf\.?|véase|vease)\s+/i);
  if (cfMatch) {
    cf = true;
    raw = raw.slice(cfMatch[0].length).trim();
  }
  raw = raw.replace(/^también\s+/i, "").trim();
  raw = stripTrailingProse(raw);
  if (!raw) return null;

  // "CIC can. 1247" / "CCEO can. 747" — Code of Canon Law, not Catechism §N.
  const canMatch = raw.match(
    /^(?<code>CIC|CDC|CICL|CCEO)\s+cans?\.?\s*(?<loc>\d{1,4})(?:\s*[-–—,]\s*(?<locEnd>\d{1,4}))?/i,
  );
  if (canMatch?.groups) {
    const wantCceo = canMatch.groups.code.toUpperCase() === "CCEO";
    const entry =
      docIndex.get(wantCceo ? "CCEO" : "CDC") ??
      docIndex.get(wantCceo ? "cceo" : "cdc") ??
      null;
    if (entry) {
      return {
        raw: atom.trim(),
        code: entry.code,
        locator: canMatch.groups.loc,
        locatorEnd: canMatch.groups.locEnd,
        cf,
        title: entry.title,
        corpusDocId: entry.corpusDocId,
        locatorType: entry.locatorType,
      };
    }
  }

  // "Concilio de Trento: DS 1740" / "Nicea II: DS 601"
  const dsEmb = raw.match(/\bDS\s+(?<loc>\d{1,5})(?:\s*[-–—]\s*(?<locEnd>\d{1,5}))?/i);
  if (dsEmb?.groups && !/^DS\s+\d/i.test(raw)) {
    const entry = docIndex.get("DS") ?? docIndex.get("ds");
    if (entry) {
      return {
        raw: atom.trim(),
        code: entry.code,
        locator: dsEmb.groups.loc,
        locatorEnd: dsEmb.groups.locEnd,
        cf,
        title: entry.title,
        corpusDocId: entry.corpusDocId,
        locatorType: entry.locatorType,
      };
    }
  }

  // "LG 16" / "CIC 1992" / "DS 3004" / "CT 20-22" / "LG 8/11" (take first)
  const m = raw.match(
    /^(?<code>[A-Za-zÁÉÍÓÚáéíóúÜüñÑ.]{1,24}(?:\s+[A-Za-zÁÉÍÓÚáéíóúÜüñÑ.]{1,24}){0,4})\s+(?<loc>\d{1,5})(?:\s*[-–—/]\s*(?<locEnd>\d{1,5}))?/,
  );
  if (!m?.groups) {
    // Code alone: "CIC" without number
    const codeOnly = raw.match(/^(?<code>[A-Za-zÁÉÍÓÚáéíóúÜüñÑ.]{2,12})\.?$/);
    if (codeOnly?.groups) {
      const token = codeOnly.groups.code;
      if (!isEcclesialTokenForm(token)) return null;
      const entry =
        docIndex.get(token.toUpperCase()) ??
        docIndex.get(normalizeAbbr(token));
      if (!entry) return null;
      return {
        raw: atom.trim(),
        code: entry.code,
        locator: null,
        cf,
        title: entry.title,
        corpusDocId: entry.corpusDocId,
        locatorType: entry.locatorType,
      };
    }
    return null;
  }

  const token = m.groups.code.trim();
  if (!isEcclesialTokenForm(token)) return null;

  const entry =
    docIndex.get(token.toUpperCase()) ??
    docIndex.get(normalizeAbbr(token));
  if (!entry) return null;

  return {
    raw: atom.trim(),
    code: entry.code,
    locator: m.groups.loc,
    locatorEnd: m.groups.locEnd,
    cf,
    title: entry.title,
    corpusDocId: entry.corpusDocId,
    locatorType: entry.locatorType,
  };
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

  // Embedded locators that look like prose prefixes (Concilio de Trento: DS 1740)
  // must not be discarded before ecclesial parse.
  if (/\bDS\s+\d{1,5}\b/i.test(t)) return false;
  if (/\b(?:CIC|CDC|CICL|CCEO)\s+cans?\./i.test(t)) return false;
  if (/\b(?:LG|GS|DV|SC|CIC|CDC)\s+\d{1,4}\b/.test(t)) return false;

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

  // Vatican.va ES: "Mc., 16, 16" / "1 Jn., 1,2-3" / "Jn. 15,4" / "1 Cor, 15,28"
  raw = raw.replace(
    /^(\d{0,1}\s*[A-Za-zÁÉÍÓÚáéíóúÜüñÑ]+)\.(?:,)?(\s+)/u,
    "$1$2",
  );
  raw = raw.replace(
    /^(\d{0,1}\s*[A-Za-zÁÉÍÓÚáéíóúÜüñÑ]+),(\s+\d)/u,
    "$1$2",
  );

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
    // ALL-CAPS magisterial codes (LG, CT, DS…) must not be parsed as bible books
    // even when they collide with lowercase bible abbreviations (Ct, Ag, …).
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

export interface ParseRefGroupOptions {
  bookIndex: BookIndex;
  docIndex?: DocIndex;
  /**
   * When parsing refs inside the CIC (or any numbered doc), bare numbers like
   * "cf. 123" can mean a point of that same document — only if no ecclesial
   * document context was carried (e.g. after "LG 56; cf. 61" → LG 61).
   */
  defaultNumberedDoc?: {
    code: string;
    corpusDocId: string;
    title?: string;
  };
}

/**
 * Parse a full ref.descripcion into typed atoms, carrying book context across `;`.
 * Resolution order per atom: noise → ecclesial (doc-codes) → bible → bare number
 * (optional default numbered doc) → unresolved.
 */
export function parseRefGroup(
  raw: string,
  bookIndexOrOpts: BookIndex | ParseRefGroupOptions,
  maybeDocIndex?: DocIndex,
): ParsedAtom[] {
  // Backward-compatible signature: parseRefGroup(raw, bookIndex)
  // New: parseRefGroup(raw, { bookIndex, docIndex, defaultNumberedDoc })
  let bookIndex: BookIndex;
  let docIndex: DocIndex | undefined;
  let defaultNumberedDoc: ParseRefGroupOptions["defaultNumberedDoc"];

  if (bookIndexOrOpts instanceof Map) {
    bookIndex = bookIndexOrOpts;
    docIndex = maybeDocIndex;
  } else {
    bookIndex = bookIndexOrOpts.bookIndex;
    docIndex = bookIndexOrOpts.docIndex;
    defaultNumberedDoc = bookIndexOrOpts.defaultNumberedDoc;
  }

  const atoms = atomizeRefGroup(raw);
  const out: ParsedAtom[] = [];
  let lastBook: BookCodeEntry | null = null;
  let lastEcclesial: EcclesialCitation | null = null;

  for (const atom of atoms) {
    if (isNoise(atom)) {
      out.push({ kind: "noise", raw: atom });
      continue;
    }

    // 1) Ecclesial / magisterial (ALL-CAPS / long aliases only)
    if (docIndex) {
      const ecc = parseEcclesialCitation(atom, docIndex);
      if (ecc) {
        lastEcclesial = ecc;
        lastBook = null;
        out.push({ kind: "ecclesial", raw: atom, citation: ecc });
        continue;
      }
    }

    // 2) Biblical
    const citation = parseBibleCitation(atom, bookIndex, lastBook);
    if (citation) {
      lastBook = {
        bookSlug: citation.bookSlug,
        bookCode: citation.bookCode,
        aliases: [],
        testament: "",
      };
      const full = bookIndex.get(normalizeAbbr(citation.bookCode));
      if (full) lastBook = full;
      lastEcclesial = null;

      out.push({ kind: "bible", raw: atom, citation });
      continue;
    }

    // 3) Bare number continuation:
    //    - after "LG 56; cf. 61" → LG 61 (carry ecclesial)
    //    - else optional same-doc CIC point when defaultNumberedDoc set
    const bare = atom
      .trim()
      .replace(/^(?:cf\.?|véase|vease)\s+/i, "")
      .trim();
    const mBare = bare.match(/^(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?\.?$/);
    if (mBare) {
      if (lastEcclesial) {
        const carried: EcclesialCitation = {
          ...lastEcclesial,
          raw: atom.trim(),
          locator: mBare[1],
          locatorEnd: mBare[2],
          cf: /^(?:cf\.?|véase)/i.test(atom.trim()),
        };
        out.push({ kind: "ecclesial", raw: atom, citation: carried });
        continue;
      }
      if (defaultNumberedDoc) {
        // Only treat bare numbers as CIC points when they look like paragraph
        // numbers (3–4 digits) to avoid hijacking "cf. 1" style noise leftovers.
        const n = parseInt(mBare[1], 10);
        if (n >= 100) {
          out.push({
            kind: "ecclesial",
            raw: atom,
            citation: {
              raw: atom.trim(),
              code: defaultNumberedDoc.code,
              locator: mBare[1],
              locatorEnd: mBare[2],
              cf: /^(?:cf\.?|véase)/i.test(atom.trim()),
              title: defaultNumberedDoc.title,
              corpusDocId: defaultNumberedDoc.corpusDocId,
              locatorType: "number",
            },
          });
          continue;
        }
      }
    }

    out.push({ kind: "unresolved", raw: atom });
  }

  return out;
}
