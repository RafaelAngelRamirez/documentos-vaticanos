/**
 * OCR residual cleanup (a)+(b) + BAC residual pass (v3):
 *  (a) collapse spaced-out letter runs: "H I S T O R I A" → "HISTORIA"
 *  (a2) collapse short (2–3) spaced dictionary words: "T a l" → "Tal"
 *  (a2b) residual shreds: "porq u e" → "porque"
 *  (a3) collapse spaced digit runs / year-page ranges: "1 9 4 7" → "1947"
 *  (a4) high-confidence OCR confusions (qiíe→que, aue→que, CONJSEJO, …)
 *  (a5) mid-line hyphen rejoin: "pro- puestas" → "propuestas"
 *  (a6) closed glued-token map + ALLCAPS peel (LOSSEÑORESSIGUIENTES, …)
 *  (a7) digit↔letter glue: "luz1" → "luz 1" (excludes bible-like codes)
 *  (b) TOC / leader-soup + BAC chrome / running headers / colophon
 *      + dual-column shred blank + aggressive index-zone → placeholder
 *      (stable unitIndex; never demerge LA∥ES columns)
 *
 * Does NOT join internal lowercase.period.lowercase (except whitelist in punct).
 * Does not paraphrase body wording. Does not blind-join arbitrary initials.
 * Does not re-OCR or re-download — post-import corpus repair only.
 */

import {
  letterTokenOverlap,
  repairOcrPunctuation,
} from "./repair_ocr_punctuation";

const LETTER_CLASS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ";
const UPPER_CLASS = "A-ZÁÉÍÓÚÜÑÀ-ÿ";

/** Placeholder written into excluded garbage units (array slot kept). */
export const OCR_GARBAGE_PLACEHOLDER =
  "[OCR: índice o tabla ilegible omitido]";

/**
 * Safe 2–3 letter Spanish (and a few FR/LA biblio) words for short
 * spaced-letter collapse. Longest-match packing; never invents prose.
 * Intentionally omits ambiguous initials (pl, ch, ii, …).
 */
const SHORT_SPACED_WORDS = new Set([
  // 2-letter Spanish function / common words
  "de",
  "la",
  "el",
  "en",
  "un",
  "no",
  "se",
  "su",
  "al",
  "lo",
  "le",
  "me",
  "te",
  "mi",
  "mí",
  "si",
  "sí",
  "ya",
  "es",
  "ha",
  "he",
  "os",
  "ni",
  "yo",
  "tu",
  "tú",
  "él",
  "da",
  "do",
  "di",
  "du",
  "et",
  "il",
  "ne",
  "re",
  "ex",
  "in",
  "ad",
  "ab",
  "ay",
  "oh",
  "ah",
  // 3-letter Spanish
  "que",
  "qué",
  "por",
  "con",
  "del",
  "los",
  "las",
  "una",
  "uno",
  "mas",
  "más",
  "sin",
  "ser",
  "son",
  "fue",
  "hay",
  "muy",
  "tan",
  "tal",
  "nos",
  "vos",
  "sus",
  "mis",
  "tus",
  "así",
  "eso",
  "esa",
  "ese",
  "aun",
  "aún",
  "han",
  "has",
  "soy",
  "era",
  "mal",
  "hoy",
  "vez",
  "fin",
  "luz",
  "paz",
  "voz",
  "ley",
  "dio",
  "ver",
  "dar",
  "van",
  "oir",
  "oí",
  // FR / LA biblio particles (high-frequency OCR spacing)
  "mme",
  "des",
  "les",
  "par",
  "sur",
  "une",
  "aux",
  "qui",
  "non",
  "oui",
  "per",
  "pro",
  "sub",
  "cum",
  "sed",
  "nec",
  "nam",
  "hic",
  "hoc",
  "hac",
  "his",
]);

export interface SpacedLetterMetrics {
  /** Count of spaced single-letter runs (≥4 letters). */
  spacedLetterRuns: number;
  /** Total single letters inside those runs. */
  spacedLetterChars: number;
  /** Short (2–3) spaced runs that match the safe dictionary. */
  shortSpacedWordHits: number;
  /** Spaced single-digit runs (≥2 digits). */
  spacedDigitRuns: number;
}

export interface GarbageUnitScore {
  isGarbage: boolean;
  score: number;
  reasons: string[];
}

export interface DocGarbageMetrics {
  units: number;
  garbageUnits: number;
  garbageRatio: number;
  spacedLetterRuns: number;
  shortSpacedWordHits: number;
  spacedDigitRuns: number;
  junkRunHits: number;
  tocLeaderHits: number;
  /**
   * Body units that remain low-quality after mechanical a+b
   * (garbled OCR pages — candidates for re-OCR, not blanked).
   */
  residualBodyNoiseUnits: number;
  /** Weighted residual severity for re-OCR queue ranking. */
  residualScore: number;
}

/**
 * Residual body noise: unreadable prose that is NOT TOC-leader garbage
 * (those are blanked by b). Used for re-OCR queue ranking only.
 * Tight heuristics to avoid false positives on name lists / initials.
 */
export function isResidualBodyNoise(text: string): boolean {
  if (!text || text.trim() === OCR_GARBAGE_PLACEHOLDER) return false;
  if (scoreGarbageUnit(text).isGarbage) return false; // handled by b
  const t = text.trim();
  const letters = (t.match(new RegExp(`[${LETTER_CLASS}]`, "g")) || []).length;
  if (letters < 50) return false;
  const vowels = (t.match(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g) || []).length;
  const vowelRatio = vowels / Math.max(letters, 1);
  const junk = (t.match(/[oncrim]{8,}/gi) || []).length;
  const words = t.match(new RegExp(`[${LETTER_CLASS}]+`, "g")) || [];
  const short = words.filter((w) => w.length <= 2).length;
  const shortRatio = short / Math.max(words.length, 1);
  // Clear junk runs left in body
  if (junk >= 2) return true;
  // Very low vowel density (broken OCR soup)
  if (vowelRatio < 0.25 && letters > 100) return true;
  // Short-token soup only when also lowish vowels (not name/degree lists)
  if (
    shortRatio > 0.55 &&
    vowelRatio < 0.42 &&
    words.length > 25 &&
    letters > 80
  ) {
    return true;
  }
  return false;
}

/**
 * Count spaced-out single-letter runs (e.g. H I S T O R I A).
 * Pattern: ≥4 single letters separated by single spaces.
 * Also counts short dictionary hits and spaced digit runs (a2/a3).
 */
export function scoreSpacedLetters(text: string): SpacedLetterMetrics {
  if (!text) {
    return {
      spacedLetterRuns: 0,
      spacedLetterChars: 0,
      shortSpacedWordHits: 0,
      spacedDigitRuns: 0,
    };
  }
  const re = new RegExp(
    `(?<![${LETTER_CLASS}])(?:[${LETTER_CLASS}])(?: [${LETTER_CLASS}]){3,}(?![${LETTER_CLASS}])`,
    "g",
  );
  let runs = 0;
  let chars = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const parts = m[0].split(" ");
    if (parts.every((p) => p.length === 1)) {
      runs += 1;
      chars += parts.length;
    }
  }
  return {
    spacedLetterRuns: runs,
    spacedLetterChars: chars,
    shortSpacedWordHits: countShortSpacedWordHits(text),
    spacedDigitRuns: countSpacedDigitRuns(text),
  };
}

/** Count whitelist-matchable 2–3 letter spaced runs (inventory). */
export function countShortSpacedWordHits(text: string): number {
  if (!text) return 0;
  const re = new RegExp(
    `(?<![${LETTER_CLASS}])(?:[${LETTER_CLASS}])(?: [${LETTER_CLASS}]){1,2}(?![${LETTER_CLASS}])`,
    "g",
  );
  let hits = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const parts = m[0].split(" ");
    if (!parts.every((p) => p.length === 1)) continue;
    // longest-match packing count (same as collapse)
    let i = 0;
    while (i < parts.length) {
      let matched = false;
      for (let len = Math.min(3, parts.length - i); len >= 2; len--) {
        const joined = parts.slice(i, i + len).join("").toLowerCase();
        if (SHORT_SPACED_WORDS.has(joined)) {
          hits += 1;
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) i += 1;
    }
  }
  return hits;
}

/** Count spaced single-digit runs of length ≥2. */
export function countSpacedDigitRuns(text: string): number {
  if (!text) return 0;
  const re = /(?<!\d)(?:\d)(?: \d){1,}(?!\d)/g;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const parts = m[0].split(" ");
    if (parts.length >= 2 && parts.every((p) => p.length === 1 && /\d/.test(p))) {
      n += 1;
    }
  }
  return n;
}

/**
 * After collapsing an all-caps run, re-insert spaces before common Spanish
 * particles glued into the same letter stream (GENERALDE → GENERAL DE).
 * Avoid peeling fragments of real words (no AL/EL mid-word false splits).
 */
function splitGluedUpperParticles(word: string): string {
  if (word.length < 6) return word;
  if (!new RegExp(`^[${UPPER_CLASS}]+$`, "u").test(word)) return word;
  // Conservative trailing particles only (longest first)
  const particles = ["DEL", "LOS", "LAS", "CON", "POR", "QUE", "DE", "LA", "EN"];
  const out: string[] = [];
  let rest = word;
  let guard = 0;
  while (rest.length >= 6 && guard++ < 6) {
    let peeled = false;
    for (const p of particles) {
      // keep a substantial stem (≥5 chars) so GENER+AL is not peeled
      if (rest.endsWith(p) && rest.length - p.length >= 5) {
        out.unshift(p);
        rest = rest.slice(0, -p.length);
        peeled = true;
        break;
      }
    }
    if (!peeled) break;
  }
  if (!out.length) return word;
  return [rest, ...out].filter(Boolean).join(" ");
}

/**
 * Pack single letters with longest-match dictionary words (2–3).
 * Returns hits so callers can fall back to blind join when nothing matched.
 */
function packShortSpacedParts(parts: string[]): { text: string; hits: number } {
  const out: string[] = [];
  let i = 0;
  let hits = 0;
  while (i < parts.length) {
    let matched = false;
    for (let len = Math.min(3, parts.length - i); len >= 2; len--) {
      const slice = parts.slice(i, i + len);
      const joined = slice.join("").toLowerCase();
      if (SHORT_SPACED_WORDS.has(joined)) {
        out.push(slice.join(""));
        i += len;
        hits += 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(parts[i]);
      i += 1;
    }
  }
  return { text: out.join(" "), hits };
}

/** Collapse one spaced-letter run; split on y/e conjunctions between words. */
function collapseSpacedRun(parts: string[]): string {
  if (parts.length < 4) return parts.join(" ");
  // Split only on "y"/"Y" (Spanish and) when both sides look like words (≥3 letters).
  // Do NOT split on "e"/"E" — those letters appear mid-word (UNIVERSIDAD, GENERAL).
  const groups: string[][] = [];
  let cur: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (
      (p === "y" || p === "Y") &&
      cur.length >= 3 &&
      parts.length - i - 1 >= 3
    ) {
      groups.push(cur);
      groups.push([p]); // keep the conjunction as its own token
      cur = [];
      continue;
    }
    cur.push(p);
  }
  if (cur.length) groups.push(cur);

  return groups
    .map((g) => {
      if (g.length === 1) return g[0];
      if (g.length < 4) {
        // short leftover — prefer dictionary pack (n o → no), else blind-join
        const packed = packShortSpacedParts(g);
        return packed.hits > 0 ? packed.text : g.join("");
      }
      // ≥4: uppercase title runs blind-join; lowercase may dictionary-pack
      // only when every letter lands in a dict word ("q u e n o" → "que no").
      // Partial hits like "... a d o" must not block "arrastrado".
      const upperCount = g.filter(
        (p) => p === p.toUpperCase() && p !== p.toLowerCase(),
      ).length;
      const isUpperRun = upperCount >= Math.ceil(g.length * 0.75);
      if (!isUpperRun) {
        const packed = packShortSpacedParts(g);
        const leftovers = packed.text
          .split(/\s+/)
          .filter((tok) => tok.length === 1).length;
        if (packed.hits > 0 && leftovers === 0) return packed.text;
      }
      return splitGluedUpperParticles(g.join(""));
    })
    .join(" ");
}

/**
 * (a) Collapse OCR spaced letters: "H I S T O R I A" → "HISTORIA",
 * "t i e r r a" → "tierra".
 * Requires ≥4 single letters separated by single spaces.
 * Does not touch "J. R. R." (periods) or normal multi-letter words.
 */
export function collapseSpacedLetters(text: string): string {
  if (!text) return text;
  const re = new RegExp(
    `(?<![${LETTER_CLASS}])(?:[${LETTER_CLASS}])(?: [${LETTER_CLASS}]){3,}(?![${LETTER_CLASS}])`,
    "g",
  );
  return text.replace(re, (chunk) => {
    const parts = chunk.split(" ");
    if (parts.length < 4) return chunk;
    if (!parts.every((p) => p.length === 1 && /[A-Za-zÁ-ÿ]/u.test(p))) {
      return chunk;
    }
    return collapseSpacedRun(parts);
  });
}

/**
 * (a2) Collapse short (2–3) spaced Spanish/function words via whitelist.
 * "T a l" → "Tal", "q u e" → "que", "d e" → "de", "n o" → "no".
 * Does not join arbitrary initials ("P L", "E J") or non-dict "y n o" as yno.
 */
export function collapseShortSpacedWords(text: string): string {
  if (!text) return text;
  const re = new RegExp(
    `(?<![${LETTER_CLASS}])(?:[${LETTER_CLASS}])(?: [${LETTER_CLASS}]){1,2}(?![${LETTER_CLASS}])`,
    "g",
  );
  return text.replace(re, (chunk) => {
    const parts = chunk.split(" ");
    if (parts.length < 2 || parts.length > 3) return chunk;
    if (!parts.every((p) => p.length === 1 && /[A-Za-zÁ-ÿ]/u.test(p))) {
      return chunk;
    }
    const packed = packShortSpacedParts(parts);
    return packed.hits > 0 ? packed.text : chunk;
  });
}

/**
 * (a3) Collapse spaced digit runs: "1 9 4 7" → "1947".
 * Also tightens digit ranges: "227 - 251" → "227-251".
 */
export function collapseSpacedDigits(text: string): string {
  if (!text) return text;
  let t = text.replace(/(?<!\d)(?:\d)(?: \d){1,}(?!\d)/g, (chunk) => {
    const parts = chunk.split(" ");
    if (parts.length < 2) return chunk;
    if (!parts.every((p) => p.length === 1 && /\d/.test(p))) return chunk;
    return parts.join("");
  });
  // Range punctuation between pure digit groups (years / pages).
  t = t.replace(/(\d)\s+-\s+(\d)/g, "$1-$2");
  return t;
}

/**
 * (a4) Tiny high-confidence OCR confusions from residual samples.
 * Mechanical only — no free literary rewrite.
 */
export function repairHighConfidenceOcrConfusions(text: string): string {
  if (!text) return text;
  let t = text;
  // qiíe / qíie style misreads of "que"
  t = t.replace(/\bqi[ií]e\b/gi, (m) =>
    m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? "Que" : "que",
  );
  t = t.replace(/\bq[ií]ie\b/gi, (m) =>
    m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase() ? "Que" : "que",
  );
  // aue (common OCR of que) — whole word only
  t = t.replace(/\baue\b/g, "que");
  t = t.replace(/\bAue\b/g, "Que");
  t = t.replace(/\bAUE\b/g, "QUE");
  // diio → dijo
  t = t.replace(/\bdiio\b/g, "dijo");
  t = t.replace(/\bDiio\b/g, "Dijo");
  t = t.replace(/\bDIIO\b/g, "DIJO");
  // CONJSEJO / limo. / SKOUNDA (BAC front samples)
  t = t.replace(/\bCONJSEJO\b/g, "CONSEJO");
  t = t.replace(/\bConjsejo\b/g, "Consejo");
  t = t.replace(/\blimo\.(?=\s|$)/gi, (m) =>
    m[0] === "L" ? "Ilmo." : "ilmo.",
  );
  t = t.replace(/\bSKOUNDA\b/g, "SEGUNDA");
  t = t.replace(/\bSkounda\b/g, "Segunda");
  // BAC front OCR shreds (closed whole-word map)
  t = t.replace(/\bAcademico\b/g, "Académico");
  t = t.replace(/\bACADEMICO\b/g, "ACADÉMICO");
  t = t.replace(/\bFslosofia\b/g, "Filosofía");
  t = t.replace(/\bFSLOSOFIA\b/g, "FILOSOFÍA");
  t = t.replace(/\bTrilingue\b/g, "Trilingüe");
  t = t.replace(/\bTRILINGUE\b/g, "TRILINGÜE");
  t = t.replace(/\bVOcALEs\b/g, "VOCALES");
  t = t.replace(/\bVocALE[sS]\b/g, "VOCALES");
  t = t.replace(/\b(?:Escrriros|Escurros|Esckrrros)\b/g, "Escritos");
  t = t.replace(/\b(?:ESCRRIROS|ESCURROS|ESCKRRROS)\b/g, "ESCRITOS");
  t = t.replace(/\bBIBLICGRAFIA\b/g, "BIBLIOGRAFIA");
  t = t.replace(/\bBiblicgrafia\b/g, "Bibliografia");
  // O ' MEARA / O 'MEARA / O' MEARA → O'MEARA
  t = t.replace(/\bO\s*'\s*MEARA\b/g, "O'MEARA");
  t = t.replace(/\bO\s*'\s*Meara\b/g, "O'Meara");
  // Doubled abbreviation period: p..255 → p.255 (not ellipsis ...)
  t = t.replace(/(?<!\.)\bp\.\.(?!\.)/gi, (m) =>
    m.startsWith("P") ? "P." : "p.",
  );
  // MlCHELE (l/I) → MICHELE when all-caps body
  t = t.replace(/\bMlCHELE\b/g, "MICHELE");
  t = t.replace(/\bMlchele\b/g, "Michele");
  return t;
}

/**
 * (a2b) Residual multi-token shreds not covered by 2–3 letter a2.
 * Closed list only — no open dictionary expansion.
 */
export function collapseResidualShreds(text: string): string {
  if (!text) return text;
  let t = text;
  // porq u e / porq  u  e → porque
  t = t.replace(/\bporq\s+u\s+e\b/gi, (m) =>
    m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()
      ? "Porque"
      : "porque",
  );
  // obst áculo / obst  áculo
  t = t.replace(/\bobst\s+áculo\b/gi, (m) =>
    m[0] === "O" ? "Obstáculo" : "obstáculo",
  );
  return t;
}

/**
 * (a5) Rejoin mid-line hyphenation left by PDF line breaks without \n:
 * "pro- puestas" → "propuestas". Does not touch "Madrid-Alcalá" style
 * proper compounds (second part capitalized) or pure digit ranges.
 */
const LOWER_ONLY = "a-záéíóúüñà-ÿ";

export function rejoinMidLineHyphen(text: string): string {
  if (!text) return text;
  // Never rejoin hyphens inside dual-column shred (would glue wrong streams)
  if (isDualColumnShredUnit(text)) return text;
  return text.replace(
    new RegExp(`([${LETTER_CLASS}]{2,})-\\s+([${LOWER_ONLY}]{2,})`, "gu"),
    (full, a: string, b: string) => {
      // Guard: first side looks like chapter label crumbs
      if (/^(?:CAP|LIB|TOM|VOL|ART)\.?$/i.test(a)) return full;
      // Guard: second side looks like abbreviation / single-stem foreign crumb
      if (b.length <= 2) return full;
      return a + b;
    },
  );
}

/** Exact glued-token fixes from Agustín BAC residual inventory. */
const GLUED_EXACT: Array<[RegExp, string]> = [
  [/\bLOSSEÑORESSIGUIENTES\b/g, "LOS SEÑORES SIGUIENTES"],
  [/\bLOSSEÑORES\b/g, "LOS SEÑORES"],
  [/\bLASSEÑORAS\b/g, "LAS SEÑORAS"],
  [/\bSANAGUSTÍN\b/g, "SAN AGUSTÍN"],
  [/\bSANAGUSTIN\b/g, "SAN AGUSTIN"],
  [/\bSanAgustín\b/g, "San Agustín"],
  [/\bSanAgustin\b/g, "San Agustin"],
  [/\blaEpístola\b/g, "la Epístola"],
  [/\blaEpistola\b/g, "la Epistola"],
  [/\bGénesisa\b/g, "Génesis a"],
  [/\bGenesisa\b/g, "Genesis a"],
  [/\bPORLOS\b/g, "POR LOS"],
  [/\bENELAÑO\b/g, "EN EL AÑO"],
  [/\bDELA\b(?=[A-ZÁÉÍÓÚÑ])/g, "DE LA "],
];

/**
 * (a6) Closed glued-token map + peel of ALLCAPS Spanish particles glued
 * to a following capital run (LOSSIGUIENTES already exact; LOS+SEÑORES…).
 */
export function repairGluedTokens(text: string): string {
  if (!text) return text;
  let t = text;
  for (const [re, rep] of GLUED_EXACT) {
    t = t.replace(re, rep);
  }
  // Peel leading particles glued into ALLCAPS: LOSSEÑORES already handled;
  // generic: LOS|LAS|DEL|SAN + ≥4 more uppercase letters
  t = t.replace(
    new RegExp(
      `\\b(LOS|LAS|DEL|SAN|POR|CON)(?=[${UPPER_CLASS}]{4,})`,
      "g",
    ),
    "$1 ",
  );
  // lowercase particle + Capitalized word glued: laEpístola already exact;
  // generic: de|la|el|del|al + Upper then lower
  t = t.replace(
    /\b(de|la|el|del|al|los|las|por|con|una|uno)(?=[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,})/g,
    "$1 ",
  );
  // Collapse accidental double spaces from peels
  t = t.replace(/[ \t]{2,}/g, " ");
  return t;
}

/**
 * (a7) Insert space between letter-run and short digit glue (luz1 → luz 1).
 * Excludes common biblical / code patterns (1Cor, 2Tim, Jn3 style left alone
 * when digit leads a short capital book code).
 */
export function repairDigitLetterGlue(text: string): string {
  if (!text) return text;
  let t = text;
  // word + 1–3 digits at word end or before letter: luz1 / sabbata22
  t = t.replace(
    new RegExp(
      `([${LETTER_CLASS}]{2,})(\\d{1,3})(?=[${LETTER_CLASS}\\s,.;:!?»"”)]|$)`,
      "gu",
    ),
    (full, w: string, d: string) => {
      // Keep things like "siglo11" still spaced — good. Skip pure Roman digits noise.
      if (/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)$/i.test(w)) return full;
      // Skip already-intentional catalog codes like "BAC422" short all-caps+digits mid
      if (w.length <= 3 && w === w.toUpperCase() && w !== w.toLowerCase()) {
        return full;
      }
      return `${w} ${d}`;
    },
  );
  // digits then long lowercase word glued: 22sabbata — rare; skip bible 1Cor
  t = t.replace(
    new RegExp(`(?<![\\d${LETTER_CLASS}])(\\d{1,2})([a-záéíóúüñ]{4,})\\b`, "gu"),
    (full, d: string, w: string) => {
      // bible-ish: 1corinthians already lower — still space is OK for Spanish body
      return `${d} ${w}`;
    },
  );
  // Do NOT touch digit+Capital book codes: 1Cor, 2Tim, 3Jn
  // (negative: our second replace only hits lowercase)
  return t;
}

/** True when unit is BAC / editorial chrome (front matter or colophon). */
export function isEditorialChromeUnit(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || t === OCR_GARBAGE_PLACEHOLDER) return false;
  if (t.length > 1200) return false;

  const patterns: RegExp[] = [
    /BIBLIOTECA\s+DE\s+AUTORES\s+CRISTIANOS/i,
    /INMEDIATA\s+RELACI[OÓ]N\s+CON\s+LA\s+B\.?\s*A\.?\s*C/i,
    /PONTIFICIA\s+UNIVERSIDAD(?:\s+DE)?\s+SALAMANCA/i,
    /Nihil\s+obstat|Nih[uü]\s+obstat/i,
    /Imprim[aá]tur|Imprim[ií]\s+polest/i,
    /Dep[oó]sito\s+legal/i,
    /Impreso\s+en\s+Espa[nñ]a/i,
    /Printed\s+in\s+Spain/i,
    /LA\s+EDITORIAL\s+CAT[OÓ]LICA/i,
    /ACAB[OÓ]SE\s+DE\s+IMPRIMIR|ACAD[OÓ]GE\s+DE\s+IM/i,
    /LAUS\s+DEO/i,
    /VICEPRESIDENTE\s*:/i,
    /Gran\s+Canciller\s+de\s+la\s+(?:Pontificia\s+)?Universidad/i,
    /APARTADO\s+466/i,
    /TALLERES\s+/i,
    /OBRAS\s+COMPLETAS\s+DE\s+SAN\s+AGUST/i,
  ];
  let hits = 0;
  for (const p of patterns) {
    if (p.test(t)) hits += 1;
  }
  if (hits >= 2) return true;
  if (hits >= 1 && t.length <= 450) return true;
  if (
    hits >= 1 &&
    /MCML|AÑO\s+19\d{2}|SEÑORES\s+SIGUIENTES|LOSSEÑORES|POR\s+LOS\s+SEÑORES/i.test(
      t,
    )
  ) {
    return true;
  }
  // Colophon shred (short ALLCAPS soup + print anchors)
  if (
    t.length <= 500 &&
    /ACAB|IMPRIMIR|LAUS\s+DEO|TALLERES|VIRGINIQUE/i.test(t) &&
    /[A-ZÁÉÍÓÚÑ]{8,}/.test(t)
  ) {
    return true;
  }
  // Commission / catalog shred (VOcALEs, Fslosofia, Esckrrros…) — blank, not rewrite
  if (t.length >= 80 && t.length <= 1200) {
    const shredMarks = (
      t.match(
        /VOcALE|Academico|Fslosofia|Trilingue|Escrriros|Escurros|Esckrrros|BIBLICGRAFIA|rFiLos|ANTIMANIQUEOSS?/gi,
      ) || []
    ).length;
    if (shredMarks >= 3) return true;
    if (
      shredMarks >= 1 &&
      /OBRAS\s+COMPLETAS|T\.\s*[IVXLC]{1,6}|ESCRITOS\s+ANT/i.test(t) &&
      t.length <= 600
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when unit is only a running page header (short, title + page crumbs).
 * Fail-closed: long prose never matches.
 */
export function isRunningHeaderUnit(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || t === OCR_GARBAGE_PLACEHOLDER) return false;
  if (t.length > 100) return false;
  // Pure short prologue / section running title
  if (/^Pr[oó]logo\s+a\s+las\s+«?Confesiones»?\.?$/i.test(t)) return true;
  if (/^ÍNDICE\s+GENERAL(?:\s+DE\s+\w+){0,4}\.?$/i.test(t)) return true;
  // S.Ag. N / S. Ag. N running headers
  if (/^S\.?\s*Ag\.?\s*\d{1,2}\b/i.test(t) && t.length <= 80) return true;
  // Contra Fausto + page crumb
  if (/^Contra\s+Fausto\b/i.test(t) && /\d{1,4}\s*$/.test(t) && t.length <= 90) {
    return true;
  }
  // Title-ish + trailing page number
  if (
    /^[A-ZÁÉÍÓÚÑ«»"A-Za-zÁ-ÿ\s.,;:—-]{12,90}\s+\d{1,4}$/.test(t) &&
    !/[.!?]{2}/.test(t)
  ) {
    const letters = (t.match(new RegExp(`[${LETTER_CLASS}]`, "g")) || []).length;
    if (letters >= 12 && letters / Math.max(t.replace(/\s/g, "").length, 1) > 0.55) {
      return true;
    }
  }
  // "DEL BIEN DEL MATRIMONIO. C-25 15" style
  if (
    /^[A-ZÁÉÍÓÚÑ\s.«»"-]{10,80}\.\s*C-?\d+/i.test(t) ||
    /^[A-ZÁÉÍÓÚÑ\s.«»"-]{10,70}\s+C-\d+/i.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Short TOC leader-soup units: dotted leaders misread as ccoo/onononic runs
 * with page-number tails. Fail-closed on long readable prose.
 */
export function isLeaderSoupUnit(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || t === OCR_GARBAGE_PLACEHOLDER) return false;
  if (t.length > 220) return false;
  const soup = (
    t.match(
      /(?:ccoo|ccoocioo|onononic|cooicn|oonin|occoc|cnnion|onorere|mio\s+cco|onn\s+nn)/gi,
    ) || []
  ).length;
  const junkRun = (t.match(/[oncrim]{8,}/gi) || []).length;
  const pageTail = /\d{1,4}\s*$/.test(t) || /\bP[aá]gs?\.?\b/i.test(t);
  if (soup >= 1 && (pageTail || junkRun >= 1) && t.length < 200) return true;
  if (junkRun >= 2 && pageTail && t.length < 180) return true;
  // Classic ".... oooonnn 87" even without named soup tokens
  if (/\.{2,}\s*[oncrim]{4,}/i.test(t) && pageTail && t.length < 200) return true;
  return false;
}

/**
 * Dual-column OCR shred: interleaved streams / page crumbs that cannot be
 * demerged mechanically. Blank only — never invent column split.
 * Fail-closed: intentional short Latin lemmata + Spanish prose stay.
 */
export function isDualColumnShredUnit(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t || t === OCR_GARBAGE_PLACEHOLDER) return false;
  // Prefer mid-length shredded units; long clean body rarely matches
  if (t.length < 40 || t.length > 900) return false;

  const hyphenBreaks = (t.match(/\w{3,}-\s+\w{2,}/g) || []).length;
  const pageCrumbs = (t.match(/\b\d{1,3}\b/g) || []).length;
  // Foreign diacritic crumbs typical of dual-column German/French biblio bleed
  const foreignCrumb = (
    t.match(/[äöüßæœ]|fiwr|fir\s|siécles|thent|zugesproch/gi) || []
  ).length;
  // Mid-unit capital islands mixed with lowercase glue (two streams)
  const midCaps = (t.match(/(?<=[a-záéíóúñ]{4,})\s+[A-ZÁÉÍÓÚÑ]{4,}\b/g) || [])
    .length;
  const soup = (t.match(/[oncrim]{8,}/gi) || []).length;

  // Strong: hyphen breaks + foreign crumb or dense page crumbs on short unit
  if (hyphenBreaks >= 2 && (foreignCrumb >= 1 || pageCrumbs >= 4) && t.length < 500) {
    return true;
  }
  if (hyphenBreaks >= 1 && foreignCrumb >= 2 && t.length < 400) return true;
  if (pageCrumbs >= 6 && midCaps >= 2 && soup >= 1 && t.length < 350) return true;
  // Short unit with ≥2 bare page-like numbers and clear stream glue
  if (
    t.length < 180 &&
    pageCrumbs >= 2 &&
    hyphenBreaks >= 1 &&
    /[A-ZÁÉÍÓÚÑ]{3,}.*[a-záéíóúñ]{4,}.*[A-ZÁÉÍÓÚÑ]{3,}/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Index / materias zone cue for stricter garbage scoring. */
export function isIndexZoneUnit(text: string): boolean {
  if (!text) return false;
  return (
    /[ÍI]NDICE\s+GENERAL/i.test(text) ||
    /[ÍI]NDICE\s+DE\s+(?:CONCEPTOS|MATERIAS|NOMBRES|LUGARES)/i.test(text) ||
    /[ÍI]ndice\s+b[ií]blico/i.test(text) ||
    /[ÍI]NDICE\s+B[IÍ]BLICO/i.test(text) ||
    /DE\s+MATERIAS\s+DE\s+LOS\s+(?:DIECIOCHO|18)/i.test(text) ||
    /\bNOTAS\b.*\b[ÍI]NDICE/i.test(text) ||
    /\b[ÍI]NDICE\b.*\bNOTAS\b/i.test(text)
  );
}

/** Units that should be blanked (slot kept) for residual BAC/OCR noise. */
export function shouldBlankUnit(text: string): boolean {
  return (
    isEditorialChromeUnit(text) ||
    isRunningHeaderUnit(text) ||
    isLeaderSoupUnit(text) ||
    isDualColumnShredUnit(text) ||
    scoreGarbageUnit(text).isGarbage
  );
}

/**
 * (b) Score a unit for TOC dotted-leader / unreadable index noise.
 * High-confidence only — good prose and citation lists should score low.
 * Index-zone units (ÍNDICE GENERAL DE MATERIAS…) use a lower threshold.
 */
export function scoreGarbageUnit(text: string): GarbageUnitScore {
  const reasons: string[] = [];
  if (!text || !text.trim()) {
    return { isGarbage: false, score: 0, reasons: [] };
  }
  const t = text;
  let score = 0;
  const indexZone = isIndexZoneUnit(t);
  if (indexZone) {
    score += 1;
    reasons.push("index_zone");
  }

  // TOC leaders: ".... oooonnn" / "..oooccc"
  const tocLeader = (
    t.match(/\.{2,}\s*[oncrim]{4,}/gi) || []
  ).length;
  if (tocLeader >= 1) {
    score += tocLeader * 3;
    reasons.push(`toc_leader=${tocLeader}`);
  }

  // Long consonant OCR junk runs (leader fill misread as letters)
  const junkRuns = (t.match(/[oncrim]{10,}/gi) || []).length;
  if (junkRuns >= 1) {
    score += junkRuns * 2;
    reasons.push(`junk_runs=${junkRuns}`);
  }

  // Named leader-soup tokens (ccoo / onononic) without classic "...."
  const leaderSoupHits = (
    t.match(/(?:ccoo|ccoocioo|onononic|cooicn|oonin|occoc)/gi) || []
  ).length;
  if (leaderSoupHits >= 1) {
    score += leaderSoupHits * 2;
    reasons.push(`leader_soup=${leaderSoupHits}`);
  }

  // Dense classic dotted leaders with page-number-ish tails
  const denseDots = (t.match(/(?:\.\s*){8,}|\.{8,}/g) || []).length;
  if (denseDots >= 1 && (junkRuns >= 1 || tocLeader >= 1 || leaderSoupHits >= 1)) {
    score += 2;
    reasons.push(`dense_dots=${denseDots}`);
  }

  const letters = (t.match(new RegExp(`[${LETTER_CLASS}]`, "g")) || []).length;
  const nonSpace = t.replace(/\s/g, "").length || 1;
  const letterRatio = letters / nonSpace;
  const digits = (t.match(/\d/g) || []).length;
  const digitRatio = digits / nonSpace;

  // Low letter density — but citation lists are digit/punct heavy and OK
  if (letterRatio < 0.4 && t.length > 50 && digitRatio < 0.25 && junkRuns + tocLeader >= 1) {
    score += 2;
    reasons.push(`low_letters=${letterRatio.toFixed(2)}`);
  }

  const vowels = (
    t.match(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g) || []
  ).length;
  const vowelRatio = vowels / Math.max(letters, 1);
  if (vowelRatio < 0.18 && letters > 40 && (junkRuns >= 1 || tocLeader >= 1)) {
    score += 2;
    reasons.push(`low_vowels=${vowelRatio.toFixed(2)}`);
  }

  // Very high junk density relative to length
  const junkChars = (t.match(/[oncrim]{6,}/gi) || []).join("").length;
  if (junkChars > 40 && junkChars / nonSpace > 0.25) {
    score += 3;
    reasons.push(`junk_density=${(junkChars / nonSpace).toFixed(2)}`);
  }

  // Index-zone: glue density / short-token soup without classic leaders
  if (indexZone && t.length > 80) {
    const words = t.match(new RegExp(`[${LETTER_CLASS}]+`, "g")) || [];
    const short = words.filter((w) => w.length <= 2).length;
    const shortRatio = short / Math.max(words.length, 1);
    const longGlued = (
      t.match(new RegExp(`[${LETTER_CLASS}]{18,}`, "g")) || []
    ).length;
    if (shortRatio > 0.4 && words.length > 20) {
      score += 2;
      reasons.push(`index_short_tokens=${shortRatio.toFixed(2)}`);
    }
    if (longGlued >= 2) {
      score += 2;
      reasons.push(`index_long_glued=${longGlued}`);
    }
    // intermixed page crumbs: many bare numbers
    if (digits > 30 && digitRatio > 0.08 && vowelRatio < 0.38) {
      score += 2;
      reasons.push("index_digit_crumb");
    }
  }

  // Threshold: need clear TOC/junk signal (not mere short citation lines)
  // Index zone: slightly lower bar (score ≥ 3) for shredded materias lists.
  // Leader-soup short units: score ≥ 3 is enough when page crumbs present.
  const pageTail = /\d{1,4}\s*$/.test(t.trim()) || /\bP[aá]gs?\.?\b/i.test(t);
  const isGarbage =
    score >= 5 ||
    (indexZone && score >= 3 && t.length > 60) ||
    (leaderSoupHits >= 1 && pageTail && t.length < 220 && score >= 3) ||
    (tocLeader >= 2 && junkRuns >= 1) ||
    junkRuns >= 3 ||
    tocLeader >= 3;

  return { isGarbage, score, reasons };
}

/** True when unit should be blanked for the reader. */
export function isGarbageUnit(text: string): boolean {
  return shouldBlankUnit(text);
}

/**
 * Apply (a)+(a2)+(a2b)+(a3)+(a4)+(a5)+(a6)+(a7) + punct soft pass.
 * Does not blank units. Idempotent on already-clean prose.
 */
export function repairOcrSpacedText(text: string): string {
  let t = collapseSpacedLetters(text);
  t = collapseShortSpacedWords(t);
  t = collapseResidualShreds(t);
  t = collapseSpacedDigits(t);
  t = rejoinMidLineHyphen(t);
  t = repairGluedTokens(t);
  t = repairDigitLetterGlue(t);
  t = repairHighConfidenceOcrConfusions(t);
  // Re-run punct repair for any new glued edges after collapse (join-safe)
  t = repairOcrPunctuation(t);
  return t;
}

export interface UnitNoiseRepairResult {
  contenido: string;
  changed: boolean;
  collapsedSpaced: boolean;
  excludedGarbage: boolean;
  garbageScore: number;
}

/**
 * (a)+(b) per unit. Garbage / chrome / header units keep the array slot:
 * contenido → placeholder.
 */
export function repairOcrNoiseUnit(
  contenido: string,
  options?: { excludeGarbage?: boolean },
): UnitNoiseRepairResult {
  const excludeGarbage = options?.excludeGarbage !== false;
  const g = scoreGarbageUnit(contenido);
  const blank =
    isEditorialChromeUnit(contenido) ||
    isRunningHeaderUnit(contenido) ||
    isLeaderSoupUnit(contenido) ||
    isDualColumnShredUnit(contenido);
  if (excludeGarbage && (g.isGarbage || blank)) {
    const next =
      contenido.trim() === OCR_GARBAGE_PLACEHOLDER
        ? contenido
        : OCR_GARBAGE_PLACEHOLDER;
    return {
      contenido: next,
      changed: next !== contenido,
      collapsedSpaced: false,
      excludedGarbage: true,
      garbageScore: blank ? Math.max(g.score, 5) : g.score,
    };
  }
  const repaired = repairOcrSpacedText(contenido);
  const collapsedOnly = collapseSpacedLetters(contenido);
  const shortOrDigit =
    collapseShortSpacedWords(collapsedOnly) !== collapsedOnly ||
    collapseSpacedDigits(collapsedOnly) !== collapsedOnly ||
    collapseResidualShreds(collapsedOnly) !== collapsedOnly;
  const mechanical =
    rejoinMidLineHyphen(contenido) !== contenido ||
    repairGluedTokens(contenido) !== contenido ||
    repairDigitLetterGlue(contenido) !== contenido ||
    repairHighConfidenceOcrConfusions(contenido) !== contenido;
  return {
    contenido: repaired,
    changed: repaired !== contenido,
    collapsedSpaced:
      collapsedOnly !== contenido || shortOrDigit || mechanical,
    excludedGarbage: false,
    garbageScore: g.score,
  };
}

/** Document-level residual metrics for re-OCR queue (c). */
export function scoreDocumentGarbage(
  unitTexts: string[],
): DocGarbageMetrics {
  let garbageUnits = 0;
  let spacedLetterRuns = 0;
  let shortSpacedWordHits = 0;
  let spacedDigitRuns = 0;
  let junkRunHits = 0;
  let tocLeaderHits = 0;
  let residualBodyNoiseUnits = 0;
  for (const t of unitTexts) {
    const g = scoreGarbageUnit(t);
    if (g.isGarbage) garbageUnits += 1;
    const sp = scoreSpacedLetters(t);
    spacedLetterRuns += sp.spacedLetterRuns;
    shortSpacedWordHits += sp.shortSpacedWordHits;
    spacedDigitRuns += sp.spacedDigitRuns;
    junkRunHits += (t.match(/[oncrim]{10,}/gi) || []).length;
    tocLeaderHits += (t.match(/\.{2,}\s*[oncrim]{4,}/gi) || []).length;
    if (isResidualBodyNoise(t)) residualBodyNoiseUnits += 1;
  }
  const units = unitTexts.length;
  const garbageRatio = units ? garbageUnits / units : 0;
  // residualScore ranks re-OCR priority after a+b (body noise dominates)
  const residualScore =
    residualBodyNoiseUnits * 15 +
    garbageUnits * 10 +
    spacedLetterRuns +
    shortSpacedWordHits +
    spacedDigitRuns +
    junkRunHits * 2 +
    tocLeaderHits * 2 +
    Math.round(garbageRatio * 1000);
  return {
    units,
    garbageUnits,
    garbageRatio: Math.round(garbageRatio * 10000) / 10000,
    spacedLetterRuns,
    shortSpacedWordHits,
    spacedDigitRuns,
    junkRunHits,
    tocLeaderHits,
    residualBodyNoiseUnits,
    residualScore,
  };
}

export { letterTokenOverlap };
