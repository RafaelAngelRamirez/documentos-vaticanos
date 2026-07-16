/**
 * Speech-oriented normalize for integrated narrator voices (Web Speech /
 * Capacitor TTS / Grok). Pure helpers — no TTS engine dependency.
 *
 * Goals:
 * - Skip OCR garbage placeholders and empty units so continuous narration
 *   advances past unreadable slots without vocalizing labels.
 * - Light mechanical cleanup for speak (HTML, ref markers, excess spaces).
 * - Detect structural titles/sections and prepare calmer, clearer spoken form.
 * - Never invent theology; never join internal lowercase.period.lowercase
 *   (que.dista / es.decir / art.cit stay intact).
 */

/** Placeholder written by ocr-abc garbage exclusion — must not be spoken. */
export const OCR_OMIT_PLACEHOLDER =
  '[OCR: índice o tabla ilegible omitido]';

/** Relative rate for structural headings (user rate × this). */
export const HEADING_RATE_SCALE = 0.82;

export type SpeechSkipReason =
  | 'empty'
  | 'placeholder'
  | 'toc_junk'
  | 'too_short'
  | null;

export type SpeechUnitKind = 'body' | 'heading';

export interface SpeechPrepResult {
  /** Text ready for TTS (empty when skip). */
  text: string;
  /** When true, narrator should advance to the next unit. */
  skip: boolean;
  reason: SpeechSkipReason;
  /** Structural title/section vs ordinary body prose. */
  kind: SpeechUnitKind;
  /**
   * Multiplier applied to the user's narrator rate (headings use a calmer pace).
   * Omitted / 1 for body prose.
   */
  rateScale?: number;
}

export interface SpeechUnitFields {
  raw: string;
  consecutivo?: string;
}

/** Extract raw unit body from corpus / legacy shapes. */
export function extractUnitRaw(unit: unknown): string {
  return extractUnitFields(unit).raw;
}

/** Raw body + optional consecutivo for heading heuristics. */
export function extractUnitFields(unit: unknown): SpeechUnitFields {
  if (unit == null) return { raw: '' };
  if (typeof unit === 'string') return { raw: unit };
  if (typeof unit !== 'object') return { raw: '' };
  const u = unit as Record<string, unknown>;
  const raw =
    u['contenido'] ?? u['texto'] ?? u['text'] ?? u['html'] ?? u['content'] ?? '';
  const consecutivo =
    u['consecutivo'] != null ? String(u['consecutivo']) : undefined;
  return { raw: String(raw ?? ''), consecutivo };
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

/** True when consecutivo looks like a numbered article/verse label (CIC 27, LG 5). */
function hasArticleConsecutivo(consecutivo?: string | null): boolean {
  const c = (consecutivo ?? '').trim();
  if (!c || c === 'no-encontrado') return false;
  // Pure numeral or numeral + letter (e.g. 27, 12a) — body unit, not a free title.
  return /^\d+[a-zA-Z]?$/.test(c);
}

/**
 * Detect structural titles/sections (PARTE, SECCIÓN, CAPÍTULO, ARTÍCULO,
 * short ALL-CAPS lines without article consecutivo, etc.).
 * Conservative: long prose is never a heading.
 */
export function isStructuralHeading(
  raw: string,
  opts?: { consecutivo?: string | null },
): boolean {
  const t = normalizeSpeakText(raw);
  if (!t) return false;
  // Length / density guards — headings are short labels, not paragraphs.
  if (t.length > 160) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 24) return false;
  // Multiple sentence endings → body prose
  const ends = (t.match(/[.!?]/g) || []).length;
  if (ends >= 2 && t.length > 50) return false;

  // Strong structural openers (with optional ordinal / number)
  if (
    /^(?:(?:la|el)\s+)?(?:primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima)?\s*(?:parte|secci[oó]n|cap[ií]tulo|art[ií]culo|t[ií]tulo|libro)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^(?:proemio|pr[oó]logo|introducci[oó]n|constituci[oó]n\s+apost[oó]lica|carta\s+apost[oó]lica)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // "1. Introducción" / "Capítulo I" style short labels
  if (
    /^\d+\.\s*(?:introducci[oó]n|proemio|pr[oó]logo|cap[ií]tulo|art[ií]culo|parte|secci[oó]n)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^cap[ií]tulo\s+(?:primero|primera|segundo|segunda|tercero|tercera|[ivxlcdm]+|\d+)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^art[ií]culo\s+\d+\b/i.test(t) ||
    /^art[ií]culo\s+(?:primero|primera|segundo|segunda)\b/i.test(t)
  ) {
    return true;
  }

  const articleNum = hasArticleConsecutivo(opts?.consecutivo);

  // Short mostly-uppercase line without article number (front-matter titles)
  if (!articleNum && t.length <= 90) {
    const letters = t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || [];
    if (letters.length >= 6) {
      const upper = letters.filter(
        (ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase(),
      ).length;
      if (upper / letters.length >= 0.72) return true;
    }
  }

  // Structural keyword somewhere, short unit, no article consecutivo
  if (
    !articleNum &&
    words.length <= 16 &&
    /\b(?:parte|secci[oó]n|cap[ií]tulo|art[ií]culo|t[ií]tulo|libro|proemio|pr[oó]logo)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}

/** Small Spanish particles left lower in title-case (except at start). */
const TITLE_CASE_SMALL = new Set([
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
  'u',
  'un',
  'una',
  'y',
]);

/**
 * Soften ALL-CAPS so TTS does not shout. Short labels → calm title-case
 * (e.g. "DIOS" → "Dios"); longer lines → sentence case. Mid-word periods kept.
 */
export function softenAllCapsForSpeech(text: string): string {
  const t = String(text ?? '');
  const letters = t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || [];
  if (letters.length < 4) return t;
  const upper = letters.filter(
    (ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase(),
  ).length;
  if (upper / letters.length < 0.65) return t;

  const lower = t.toLocaleLowerCase('es');
  const words = lower.split(/\s+/).filter(Boolean);
  // Short structural titles: title-case for sense at the ear
  if (words.length <= 16) {
    return words
      .map((w, i) => {
        const m = w.match(/^([^A-Za-zÁ-ÿ]*)(.*?)([^A-Za-zÁ-ÿ]*)$/u);
        if (!m) return w;
        const [, lead, core, trail] = m;
        if (!core) return w;
        const bare = core.normalize('NFC');
        if (i > 0 && TITLE_CASE_SMALL.has(bare)) {
          return `${lead}${bare}${trail}`;
        }
        const cap =
          bare.charAt(0).toLocaleUpperCase('es') + bare.slice(1);
        return `${lead}${cap}${trail}`;
      })
      .join(' ');
  }

  // Longer: sentence case
  return lower.replace(
    /(^|[.!?…:\n]\s*)([a-záéíóúüñàèìòù])/g,
    (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase('es'),
  );
}

/**
 * Insert a short pause after the structural label so the ear hears
 * "Primera parte. La profesión de la fe." instead of a run-on shout.
 */
export function insertStructuralPauses(text: string): string {
  let t = String(text ?? '').trim();
  if (!t) return t;

  // "Primera parte LA …" / "Capítulo primero: REST" / "Artículo 1 REST"
  const labelThenRest =
    /^((?:(?:la|el)\s+)?(?:primera|segunda|tercera|cuarta|quinta|sexta|séptima|septima|octava|novena|décima|decima)\s+)?(parte|sección|seccion|capítulo|capitulo|artículo|articulo|título|titulo|libro)(\s+(?:primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|[ivxlcdm]+|\d+[ºª°]?))?(\s*[:.\-–—]\s*|\s+)(.+)$/i;

  const m = t.match(labelThenRest);
  if (m) {
    const ord = (m[1] || '').trim();
    const kind = (m[2] || '').trim();
    const num = (m[3] || '').trim();
    let rest = (m[5] || '').trim();
    if (rest) {
      // Drop a leading colon-like glue already consumed
      rest = rest.replace(/^[:.\-–—]\s*/, '');
      // Capitalize rest start for a new spoken clause
      rest = rest.replace(
        /^([a-záéíóúüñ])/i,
        (ch) => ch.toLocaleUpperCase('es'),
      );
      const label = [ord, kind, num].filter(Boolean).join(' ').replace(/\s+/g, ' ');
      t = `${label}. ${rest}`;
    }
  }

  // "1. Introducción" → keep; ensure space after numeral period is calm
  t = t.replace(/^(\d+)\.\s*/u, '$1. ');

  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Prepare spoken form for a structural heading: softer case, label pause,
 * terminal pause for a calmer listen.
 */
export function prepareHeadingSpeakText(raw: string): string {
  let t = normalizeSpeakText(raw);
  if (!t) return '';
  t = softenAllCapsForSpeech(t);
  t = insertStructuralPauses(t);
  // Terminal breath so continuous narration does not crash into the body.
  // Prefer a single ellipsis (engines pause more than a lone period).
  t = t.replace(/[.!?…]+$/u, '').trim();
  t = `${t}…`;
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Prepare unit text for integrated voices.
 * @returns skip=true when the unit must not be spoken.
 */
export function prepareSpeechText(
  raw: string,
  opts?: { consecutivo?: string | null },
): SpeechPrepResult {
  const original = String(raw ?? '').trim();
  if (!original) {
    return { text: '', skip: true, reason: 'empty', kind: 'body' };
  }
  if (
    original === OCR_OMIT_PLACEHOLDER ||
    /^\[OCR:\s*.*omitido\]$/i.test(original) ||
    /índice o tabla ilegible omitido/i.test(original)
  ) {
    return { text: '', skip: true, reason: 'placeholder', kind: 'body' };
  }
  if (isSpeakHostileJunk(original)) {
    return { text: '', skip: true, reason: 'toc_junk', kind: 'body' };
  }

  const normalized = normalizeSpeakText(original);
  if (!normalized) {
    return { text: '', skip: true, reason: 'empty', kind: 'body' };
  }
  // Extremely short after strip (lone punctuation) — skip
  const letters = (normalized.match(/[A-Za-zÁ-ÿ]/g) || []).length;
  if (letters < 2) {
    return { text: '', skip: true, reason: 'too_short', kind: 'body' };
  }

  if (isStructuralHeading(original, opts)) {
    const text = prepareHeadingSpeakText(original);
    if (!text) {
      return { text: '', skip: true, reason: 'empty', kind: 'heading' };
    }
    return {
      text,
      skip: false,
      reason: null,
      kind: 'heading',
      rateScale: HEADING_RATE_SCALE,
    };
  }

  return { text: normalized, skip: false, reason: null, kind: 'body' };
}

/**
 * Find the next speakable unit index at or after `from`, or null if none.
 * Used by continuous narration to jump over placeholders without deep recursion.
 */
export function nextSpeakableIndex(
  units: unknown[],
  from: number,
): { index: number; prep: SpeechPrepResult } | null {
  if (!Array.isArray(units) || from >= units.length) return null;
  for (let i = Math.max(0, from); i < units.length; i++) {
    const fields = extractUnitFields(units[i]);
    const prep = prepareSpeechText(fields.raw, {
      consecutivo: fields.consecutivo,
    });
    if (!prep.skip && prep.text) {
      return { index: i, prep };
    }
  }
  return null;
}
