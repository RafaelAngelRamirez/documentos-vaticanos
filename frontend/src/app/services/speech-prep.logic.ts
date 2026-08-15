/**
 * Speech-oriented normalize for narrator voices (Web Speech / native / Grok).
 * Counts Unicode letters so zh/hi/ar units are not skipped as "too_short".
 */

export type SpeechKind = 'heading' | 'body';

export interface SpeechPrepResult {
  text: string;
  skip: boolean;
  reason?: 'empty' | 'too_short' | 'ocr_noise';
  kind: SpeechKind;
  /** Multiplier applied to the user's narrator rate (headings use a calmer pace). */
  rateScale: number;
}

const LETTER_RE = /\p{L}/gu;

export function countLetters(text: string): number {
  if (!text) return 0;
  const matches = text.match(LETTER_RE);
  return matches ? matches.length : 0;
}

export function looksLikeOcrNoise(text: string): boolean {
  const letters = countLetters(text);
  const compact = text.replace(/\s+/g, '');
  if (!compact) return true;
  if (letters === 0 && compact.length > 8) return true;
  const symbols = (compact.match(/[^\p{L}\p{N}]/gu) || []).length;
  return letters > 0 && symbols / compact.length > 0.65;
}

export function prepareSpeechText(
  raw: string | null | undefined,
  opts?: { kind?: SpeechKind }
): SpeechPrepResult {
  const kind = opts?.kind ?? 'body';
  const normalized = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { text: '', skip: true, reason: 'empty', kind, rateScale: 1 };
  }
  if (looksLikeOcrNoise(normalized)) {
    return { text: '', skip: true, reason: 'ocr_noise', kind, rateScale: 1 };
  }
  const letters = countLetters(normalized);
  if (letters < 2) {
    return { text: '', skip: true, reason: 'too_short', kind, rateScale: 1 };
  }
  return {
    text: normalized,
    skip: false,
    kind,
    rateScale: kind === 'heading' ? 0.92 : 1,
  };
}

export function nextSpeakableIndex(
  units: Array<{ contenido?: string }>,
  from: number
): number {
  for (let i = Math.max(0, from); i < units.length; i++) {
    const prep = prepareSpeechText(units[i]?.contenido);
    if (!prep.skip) return i;
  }
  return -1;
}

export function localeToBcp47(locale: string | null | undefined): string {
  const loc = (locale || 'es').toLowerCase().split('-')[0];
  const map: Record<string, string> = {
    es: 'es-ES',
    en: 'en-US',
    zh: 'zh-CN',
    hi: 'hi-IN',
    ar: 'ar',
    la: 'la',
  };
  return map[loc] || `${loc}`;
}
