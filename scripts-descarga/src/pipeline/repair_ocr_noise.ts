/**
 * OCR residual cleanup (a)+(b):
 *  (a) collapse spaced-out letter runs: "H I S T O R I A" → "HISTORIA"
 *  (b) detect TOC / dotted-leader garbage units for exclusion (blank content,
 *      same array slot → stable unitIndex)
 *
 * Does NOT join internal lowercase.period.lowercase (ocr-punct v2 safety).
 * Does not paraphrase body wording.
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

export interface SpacedLetterMetrics {
  /** Count of spaced single-letter runs (≥4 letters). */
  spacedLetterRuns: number;
  /** Total single letters inside those runs. */
  spacedLetterChars: number;
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
 */
export function scoreSpacedLetters(text: string): SpacedLetterMetrics {
  if (!text) return { spacedLetterRuns: 0, spacedLetterChars: 0 };
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
  return { spacedLetterRuns: runs, spacedLetterChars: chars };
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
        // short leftover (e.g. accidental) — join if all single letters
        return g.join("");
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
 * Apply (a) collapse + optional punct soft pass; does not blank units.
 * Safe to run on any unit contenido.
 */
export function repairOcrSpacedText(text: string): string {
  let t = collapseSpacedLetters(text);
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
  const collapsed = collapseSpacedLetters(contenido);
  const repaired = repairOcrPunctuation(collapsed);
  return {
    contenido: repaired,
    changed: repaired !== contenido,
    collapsedSpaced: collapsed !== contenido,
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
  let junkRunHits = 0;
  let tocLeaderHits = 0;
  let residualBodyNoiseUnits = 0;
  for (const t of unitTexts) {
    const g = scoreGarbageUnit(t);
    if (g.isGarbage) garbageUnits += 1;
    const sp = scoreSpacedLetters(t);
    spacedLetterRuns += sp.spacedLetterRuns;
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
    junkRunHits * 2 +
    tocLeaderHits * 2 +
    Math.round(garbageRatio * 1000);
  return {
    units,
    garbageUnits,
    garbageRatio: Math.round(garbageRatio * 10000) / 10000,
    spacedLetterRuns,
    junkRunHits,
    tocLeaderHits,
    residualBodyNoiseUnits,
    residualScore,
  };
}

export { letterTokenOverlap };
