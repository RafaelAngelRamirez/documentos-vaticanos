/**
 * OCR residual cleanup (a)+(b) + short residual spacing:
 *  (a) collapse spaced-out letter runs: "H I S T O R I A" → "HISTORIA"
 *  (a2) collapse short (2–3) spaced dictionary words: "T a l" → "Tal"
 *  (a3) collapse spaced digit runs / year-page ranges: "1 9 4 7" → "1947"
 *  (a4) tiny high-confidence OCR confusions (qiíe→que, O'MEARA, p..)
 *  (b) detect TOC / dotted-leader garbage units for exclusion (blank content,
 *      same array slot → stable unitIndex)
 *
 * Does NOT join internal lowercase.period.lowercase (ocr-punct v2 safety).
 * Does not paraphrase body wording. Does not blind-join arbitrary initials.
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
 * (b) Score a unit for TOC dotted-leader / unreadable index noise.
 * High-confidence only — good prose and citation lists should score low.
 */
export function scoreGarbageUnit(text: string): GarbageUnitScore {
  const reasons: string[] = [];
  if (!text || !text.trim()) {
    return { isGarbage: false, score: 0, reasons: [] };
  }
  const t = text;
  let score = 0;

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

  // Dense classic dotted leaders with page-number-ish tails
  const denseDots = (t.match(/(?:\.\s*){8,}|\.{8,}/g) || []).length;
  if (denseDots >= 1 && (junkRuns >= 1 || tocLeader >= 1)) {
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

  // Threshold: need clear TOC/junk signal (not mere short citation lines)
  const isGarbage =
    score >= 5 ||
    (tocLeader >= 2 && junkRuns >= 1) ||
    junkRuns >= 3 ||
    (tocLeader >= 3);

  return { isGarbage, score, reasons };
}

/** True when unit should be blanked for the reader. */
export function isGarbageUnit(text: string): boolean {
  return scoreGarbageUnit(text).isGarbage;
}

/**
 * Apply (a)+(a2)+(a3)+(a4) + punct soft pass; does not blank units.
 * Safe to run on any unit contenido. Idempotent on already-clean prose.
 */
export function repairOcrSpacedText(text: string): string {
  let t = collapseSpacedLetters(text);
  t = collapseShortSpacedWords(t);
  t = collapseSpacedDigits(t);
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
 * (a)+(b) per unit. Garbage units keep the array slot: contenido → placeholder.
 */
export function repairOcrNoiseUnit(
  contenido: string,
  options?: { excludeGarbage?: boolean },
): UnitNoiseRepairResult {
  const excludeGarbage = options?.excludeGarbage !== false;
  const g = scoreGarbageUnit(contenido);
  if (excludeGarbage && g.isGarbage) {
    const next =
      contenido.trim() === OCR_GARBAGE_PLACEHOLDER
        ? contenido
        : OCR_GARBAGE_PLACEHOLDER;
    return {
      contenido: next,
      changed: next !== contenido,
      collapsedSpaced: false,
      excludedGarbage: true,
      garbageScore: g.score,
    };
  }
  const repaired = repairOcrSpacedText(contenido);
  const collapsedOnly = collapseSpacedLetters(contenido);
  const shortOrDigit =
    collapseShortSpacedWords(collapsedOnly) !== collapsedOnly ||
    collapseSpacedDigits(collapsedOnly) !== collapsedOnly;
  return {
    contenido: repaired,
    changed: repaired !== contenido,
    collapsedSpaced:
      collapsedOnly !== contenido ||
      shortOrDigit ||
      repairHighConfidenceOcrConfusions(contenido) !== contenido,
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
