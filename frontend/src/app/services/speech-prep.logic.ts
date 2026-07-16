/**
 * Speech-oriented normalize for integrated narrator voices (Web Speech /
 * Capacitor TTS / Grok). Pure helpers — no TTS engine dependency.
 *
 * Goals:
 * - Skip OCR garbage placeholders and empty units so continuous narration
 *   advances past unreadable slots without vocalizing labels.
 * - Light mechanical cleanup for speak (HTML, ref markers, excess spaces).
 * - Never invent theology; never join internal lowercase.period.lowercase
 *   (que.dista / es.decir / art.cit stay intact).
 */

/** Placeholder written by ocr-abc garbage exclusion — must not be spoken. */
export const OCR_OMIT_PLACEHOLDER =
  '[OCR: índice o tabla ilegible omitido]';

export type SpeechSkipReason =
  | 'empty'
  | 'placeholder'
  | 'toc_junk'
  | 'too_short'
  | null;

export interface SpeechPrepResult {
  /** Text ready for TTS (empty when skip). */
  text: string;
  /** When true, narrator should advance to the next unit. */
  skip: boolean;
  reason: SpeechSkipReason;
}

/** Extract raw unit body from corpus / legacy shapes. */
export function extractUnitRaw(unit: unknown): string {
  if (unit == null) return '';
  if (typeof unit === 'string') return unit;
  if (typeof unit !== 'object') return '';
  const u = unit as Record<string, unknown>;
  const raw =
    u['contenido'] ?? u['texto'] ?? u['text'] ?? u['html'] ?? u['content'] ?? '';
  return String(raw ?? '');
}

/**
 * True when the unit is high-confidence TOC / dotted-leader OCR junk
 * that would be painful if spoken aloud.
 */
export function isSpeakHostileJunk(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  // OCR abc placeholder (exact or substring)
  if (
    t === OCR_OMIT_PLACEHOLDER ||
    /^\[OCR:\s*.*omitido\]$/i.test(t) ||
    /índice o tabla ilegible omitido/i.test(t)
  ) {
    return true;
  }
  // Dotted leaders misread as letter soup: "..oooonnn" / "ooooccc"
  const tocLeader = (t.match(/\.{2,}\s*[oncrim]{4,}/gi) || []).length;
  const junkRuns = (t.match(/[oncrim]{10,}/gi) || []).length;
  if (tocLeader >= 2 || junkRuns >= 3) return true;
  if (tocLeader >= 1 && junkRuns >= 1) return true;
  // Extreme consonant soup (very low vowels) on longer strings
  const letters = (t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]/g) || []).length;
  if (letters > 80) {
    const vowels = (t.match(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g) || []).length;
    if (vowels / letters < 0.18 && junkRuns >= 1) return true;
  }
  return false;
}

/**
 * Light normalize for TTS: strip chrome, collapse whitespace.
 * Does not rejoin mid-word periods; does not paraphrase.
 */
export function normalizeSpeakText(raw: string): string {
  let t = String(raw ?? '');
  // Ref placeholders from magisterium HTML pipeline
  t = t.replace(/\[\+\[\d+\]\+\]/g, ' ');
  // Simple HTML tags
  t = t.replace(/<[^>]+>/g, ' ');
  // Collapse horizontal whitespace (keep intentional periods)
  t = t.replace(/[ \t\f\v]+/g, ' ');
  // Soften extreme ellipsis leaders for any residual spoken text
  t = t.replace(/(?:\s*\.\s*){4,}/g, '… ');
  // Trim leftover spaced ellipsis glue
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Prepare unit text for integrated voices.
 * @returns skip=true when the unit must not be spoken.
 */
export function prepareSpeechText(raw: string): SpeechPrepResult {
  const original = String(raw ?? '').trim();
  if (!original) {
    return { text: '', skip: true, reason: 'empty' };
  }
  if (
    original === OCR_OMIT_PLACEHOLDER ||
    /^\[OCR:\s*.*omitido\]$/i.test(original) ||
    /índice o tabla ilegible omitido/i.test(original)
  ) {
    return { text: '', skip: true, reason: 'placeholder' };
  }
  if (isSpeakHostileJunk(original)) {
    return { text: '', skip: true, reason: 'toc_junk' };
  }

  const text = normalizeSpeakText(original);
  if (!text) {
    return { text: '', skip: true, reason: 'empty' };
  }
  // Extremely short after strip (lone punctuation) — skip
  const letters = (text.match(/[A-Za-zÁ-ÿ]/g) || []).length;
  if (letters < 2) {
    return { text: '', skip: true, reason: 'too_short' };
  }
  return { text, skip: false, reason: null };
}

/**
 * Find the next speakable unit index at or after `from`, or -1 if none.
 * Used by continuous narration to jump over placeholders without deep recursion.
 */
export function nextSpeakableIndex(
  units: unknown[],
  from: number,
): { index: number; prep: SpeechPrepResult } | null {
  if (!Array.isArray(units) || from >= units.length) return null;
  for (let i = Math.max(0, from); i < units.length; i++) {
    const prep = prepareSpeechText(extractUnitRaw(units[i]));
    if (!prep.skip && prep.text) {
      return { index: i, prep };
    }
  }
  return null;
}
