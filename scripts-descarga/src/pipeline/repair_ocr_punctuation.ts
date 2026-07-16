/**
 * Conservative mechanical OCR punctuation repair.
 * Restores spacing around punctuation without inventing wording.
 *
 * Safe rules only: space-before-punct, glued clause punct, sentence
 * boundaries after multi-letter lowercase runs, internal OCR period
 * splits, spaced ellipsis leaders. Does not re-segment units or
 * paraphrase theological content.
 */

export interface OcrPunctMetrics {
  spaceBeforePunct: number;
  gluedClausePunct: number;
  missingSentenceSpace: number;
  internalWordPeriod: number;
  /** Weighted sum used for inventory ranking. */
  defectScore: number;
}

export interface RepairOcrPunctuationResult {
  text: string;
  changed: boolean;
  before: OcrPunctMetrics;
  after: OcrPunctMetrics;
}

const LETTER = "A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ";
const LOWER = "a-záéíóúüñà-ÿ";
const UPPER = "A-ZÁÉÍÓÚÜÑÀ-ÿ";

/** Count mechanical OCR punctuation defects (inventory / pre-post). */
export function scoreOcrPunctuation(text: string): OcrPunctMetrics {
  if (!text) {
    return {
      spaceBeforePunct: 0,
      gluedClausePunct: 0,
      missingSentenceSpace: 0,
      internalWordPeriod: 0,
      defectScore: 0,
    };
  }
  const spaceBeforePunct = (
    text.match(new RegExp(`[ \\t]+[,.;:!?¿¡]`, "g")) || []
  ).length;
  const gluedClausePunct = (
    text.match(new RegExp(`[,;:][${LETTER}]`, "g")) || []
  ).length;
  const missingSentenceSpace = (
    text.match(new RegExp(`[${LOWER}]{2}\\.[${UPPER}]`, "g")) || []
  ).length;
  const internalWordPeriod = (
    text.match(new RegExp(`[${LOWER}]{2}\\.[${LOWER}]{2}`, "g")) || []
  ).length;
  const defectScore =
    spaceBeforePunct +
    gluedClausePunct * 2 +
    missingSentenceSpace +
    internalWordPeriod * 2;
  return {
    spaceBeforePunct,
    gluedClausePunct,
    missingSentenceSpace,
    internalWordPeriod,
    defectScore,
  };
}

/**
 * Pure string transform: OCR punctuation mechanics → conventional spacing.
 * Idempotent for already-clean text. Preserves letter tokens (no rewrite).
 */
export function repairOcrPunctuation(text: string): string {
  if (!text) return text;

  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Spaced ellipsis / TOC dotted leaders: ". . . ." or "..." runs → "..."
  t = t.replace(/(?:\s*\.\s*){3,}/g, "...");
  // Ensure space after ellipsis when a letter/opening quote follows
  t = t.replace(
    new RegExp(`\\.\\.\\.(?=[${LETTER}«"“])`, "g"),
    "... ",
  );

  // Drop horizontal whitespace before clause/sentence punctuation
  t = t.replace(/[ \t]+([,;:!?¿¡])/g, "$1");
  // Drop space before a single period (not "...")
  t = t.replace(/[ \t]+\.(?!\.)/g, ".");

  // Space after comma/semicolon when glued to a letter: "Nerón7,el" → "Nerón7, el"
  t = t.replace(new RegExp(`([,;])(?=[${LETTER}])`, "g"), "$1 ");
  // Space after colon when glued to a letter: "ANTIMANIQUEOS:ESCRITOS"
  t = t.replace(new RegExp(`:(?=[${LETTER}])`, "g"), ": ");
  // Space after ! ? when glued to a letter
  t = t.replace(new RegExp(`([!?¿¡])(?=[${LETTER}])`, "g"), "$1 ");

  // Internal OCR period splitting a word: "sancti.ficationis" → "sanctificationis"
  // Requires ≥2 lowercase letters on each side so single-letter abbrs (S.Ag.) survive.
  t = t.replace(
    new RegExp(`(?<=[${LOWER}]{2})\\.(?=[${LOWER}]{2})`, "g"),
    "",
  );

  // Missing space after sentence period: "omisiones.En" → "omisiones. En"
  // Same ≥2 lowercase guard avoids "n.I", "c.7", "S.Ag".
  t = t.replace(
    new RegExp(`(?<=[${LOWER}]{2})\\.(?=[${UPPER}])`, "g"),
    ". ",
  );

  // Collapse horizontal whitespace runs; keep paragraph breaks
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t;
}

/** Repair + metrics for one string (unit or full document body). */
export function repairOcrPunctuationWithStats(
  text: string,
): RepairOcrPunctuationResult {
  const before = scoreOcrPunctuation(text);
  const repaired = repairOcrPunctuation(text);
  const after = scoreOcrPunctuation(repaired);
  return {
    text: repaired,
    changed: repaired !== text,
    before,
    after,
  };
}

/** Letter-only tokens for essence / non-rewrite checks. */
export function letterTokens(text: string): string[] {
  return text.match(new RegExp(`[${LETTER}]{2,}`, "g")) || [];
}

/**
 * Multiset overlap of letter tokens (0–1). Near 1.0 means wording essence
 * was preserved (only spacing/punct changed).
 */
export function letterTokenOverlap(before: string, after: string): number {
  const a = letterTokens(before);
  const b = letterTokens(after);
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const ca = new Map<string, number>();
  for (const t of a) ca.set(t, (ca.get(t) || 0) + 1);
  let common = 0;
  for (const t of b) {
    const n = ca.get(t) || 0;
    if (n > 0) {
      common += 1;
      ca.set(t, n - 1);
    }
  }
  return common / Math.max(a.length, b.length);
}
