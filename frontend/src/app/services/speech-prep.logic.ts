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

/**
 * Visual / structural hierarchy for reader headings.
 * 0 = body (not a heading);
 * 1 = major (PARTE, LIBRO, constitución/carta apostólica);
 * 2 = mid (SECCIÓN, CAPÍTULO, TÍTULO, PRÓLOGO);
 * 3 = minor subtitle (ARTÍCULO, ALL-CAPS corto, etc.).
 * Higher rank → larger type in the reader (1 > 2 > 3 > body).
 */
export type HeadingLevel = 0 | 1 | 2 | 3;

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
  /** Heading hierarchy level (0 when body). */
  headingLevel?: HeadingLevel;
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

/**
 * Rank a unit for visual hierarchy in the reader.
 * Returns 0 for body prose; 1–3 for structural headings (1 = most prominent).
 */
export function headingLevel(
  raw: string,
  opts?: { consecutivo?: string | null },
): HeadingLevel {
  if (!isStructuralHeading(raw, opts)) return 0;
  const t = normalizeSpeakText(raw);

  // Level 1 — major book/part divisions and document-level titles
  if (
    /^(?:(?:la|el)\s+)?(?:primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima)?\s*parte\b/i.test(
      t,
    ) ||
    /^(?:(?:el|la)\s+)?libro\b/i.test(t) ||
    /^(?:constituci[oó]n\s+apost[oó]lica|carta\s+apost[oó]lica)\b/i.test(t)
  ) {
    return 1;
  }
  // "… PARTE …" as the primary structural keyword (short unit already)
  if (
    /\bparte\b/i.test(t) &&
    !/\b(?:secci[oó]n|cap[ií]tulo|art[ií]culo)\b/i.test(t)
  ) {
    return 1;
  }

  // Level 2 — sections, chapters, legal títulos, prologues
  if (
    /\bsecci[oó]n\b/i.test(t) ||
    /\bcap[ií]tulo\b/i.test(t) ||
    /^(?:t[ií]tulo)\b/i.test(t) ||
    /^(?:proemio|pr[oó]logo)\b/i.test(t) ||
    /\bt[ií]tulo\s+(?:[ivxlcdm]+|\d+)\b/i.test(t)
  ) {
    return 2;
  }

  // Level 3 — articles and residual short headings (ALL-CAPS, intro, …)
  return 3;
}

/** CSS modifier class for punto/reader heading levels (empty when body). */
export function headingLevelClass(level: HeadingLevel): string {
  if (level === 1) return 'punto-heading--1';
  if (level === 2) return 'punto-heading--2';
  if (level === 3) return 'punto-heading--3';
  return '';
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
 * Classic Roman numeral (I–MMMCMXCIX). Kept uppercase for TTS
 * so "III" is not spoken as "Iii".
 */
export function isRomanNumeralToken(token: string): boolean {
  const s = (token || '').trim();
  if (!s || s.length > 12) return false;
  return /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i.test(
    s,
  );
}

/**
 * Soften ALL-CAPS so TTS does not shout. Short labels → calm title-case
 * (e.g. "DIOS" → "Dios"); Roman numerals stay uppercase; mid-word periods kept.
 */
export function softenAllCapsForSpeech(text: string): string {
  const t = String(text ?? '');
  const letters = t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || [];
  if (letters.length < 4) return t;
  const upper = letters.filter(
    (ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase(),
  ).length;
  if (upper / letters.length < 0.65) return t;

  const words = t.split(/\s+/).filter(Boolean);
  // Short structural titles: title-case for sense at the ear
  if (words.length <= 16) {
    return words
      .map((w, i) => {
        const m = w.match(/^([^A-Za-zÁ-ÿ]*)(.*?)([^A-Za-zÁ-ÿ]*)$/u);
        if (!m) return w;
        const [, lead, core, trail] = m;
        if (!core) return w;
        // Roman numerals: keep full uppercase for correct TTS
        if (isRomanNumeralToken(core)) {
          return `${lead}${core.toLocaleUpperCase('es')}${trail}`;
        }
        const bare = core.toLocaleLowerCase('es').normalize('NFC');
        if (i > 0 && TITLE_CASE_SMALL.has(bare)) {
          return `${lead}${bare}${trail}`;
        }
        const cap =
          bare.charAt(0).toLocaleUpperCase('es') + bare.slice(1);
        return `${lead}${cap}${trail}`;
      })
      .join(' ');
  }

  // Longer: sentence case, but protect Roman tokens
  return words
    .map((w) => {
      const m = w.match(/^([^A-Za-zÁ-ÿ]*)(.*?)([^A-Za-zÁ-ÿ]*)$/u);
      if (!m) return w;
      const [, lead, core, trail] = m;
      if (core && isRomanNumeralToken(core)) {
        return `${lead}${core.toLocaleUpperCase('es')}${trail}`;
      }
      return w.toLocaleLowerCase('es');
    })
    .join(' ')
    .replace(
      /(^|[.!?…:\n]\s*)([a-záéíóúüñàèìòù])/g,
      (_m, pre: string, ch: string) => pre + ch.toLocaleUpperCase('es'),
    );
}

/** Kind + optional ordinal/numeral/roman that belongs to the label itself. */
const STRUCT_LABEL_CORE =
  '((?:(?:la|el)\\s+)?' +
  '(?:primera|segunda|tercera|cuarta|quinta|sexta|séptima|septima|octava|novena|décima|decima)\\s+)?' +
  '(parte|sección|seccion|capítulo|capitulo|artículo|articulo|título|titulo|libro)' +
  '(?:\\s+(?:primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta|' +
  'sexto|sexta|séptimo|séptima|septimo|septima|octavo|octava|noveno|novena|décimo|décima|' +
  'decimo|decima|[ivxlcdm]+|\\d+[ºª°]?))?';

/** True when a token is only an ordinal word / digit / roman (belongs in the label). */
function isBareStructuralNumber(token: string): boolean {
  return /^(?:primero|primera|segundo|segunda|tercero|tercera|cuarto|cuarta|quinto|quinta|sexto|sexta|séptimo|séptima|septimo|septima|octavo|octava|noveno|novena|décimo|décima|decimo|decima|[ivxlcdm]+|\d+[ºª°]?)$/i.test(
    (token || '').trim(),
  );
}

/**
 * Insert a short pause after the structural label so the ear hears
 * "Primera parte. La profesión de la fe." instead of a run-on shout.
 * Standalone labels ("Capítulo Primero", "Artículo 1", "Capítulo II")
 * stay whole — only real trailing title text becomes a second clause.
 */
export function insertStructuralPauses(text: string): string {
  let t = String(text ?? '').trim();
  if (!t) return t;

  // Label includes kind + its own ordinal/number/roman; rest must be real title text.
  const labelThenRest = new RegExp(
    `^${STRUCT_LABEL_CORE}(?:\\s*[:.\\-–—]\\s*|\\s+)(.+)$`,
    'i',
  );

  const m = t.match(labelThenRest);
  if (m) {
    let rest = (m[m.length - 1] || '').trim();
    rest = rest.replace(/^[:.\-–—]\s*/, '');
    // Guard: lone ordinal/numeral/roman is part of the label, not a second clause
    if (rest && !isBareStructuralNumber(rest)) {
      const label = m[0]
        .slice(0, m[0].length - (m[m.length - 1] || '').length)
        .replace(/[:.\-–—\s]+$/u, '')
        .trim();
      const firstTok = rest.split(/\s+/)[0] || '';
      if (isRomanNumeralToken(firstTok)) {
        rest = rest.replace(
          /^([ivxlcdm]+)/i,
          (r) => r.toLocaleUpperCase('es'),
        );
      } else {
        rest = rest.replace(
          /^([a-záéíóúüñ])/i,
          (ch) => ch.toLocaleUpperCase('es'),
        );
      }
      if (label && rest) {
        t = `${label}. ${rest}`;
      }
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
    const level = headingLevel(original, opts);
    if (!text) {
      return {
        text: '',
        skip: true,
        reason: 'empty',
        kind: 'heading',
        headingLevel: level,
      };
    }
    return {
      text,
      skip: false,
      reason: null,
      kind: 'heading',
      rateScale: HEADING_RATE_SCALE,
      headingLevel: level,
    };
  }

  return {
    text: normalized,
    skip: false,
    reason: null,
    kind: 'body',
    headingLevel: 0,
  };
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
