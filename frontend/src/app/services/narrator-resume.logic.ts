/**
 * Dónde seguir cuando cambian voz, acento o velocidad a mitad de una locución.
 * Puro: sin motor de TTS. El cursor lo aporta el servicio (límite de
 * palabra o de frase, o una estimación si el motor no lo da).
 */

const WORD_CHAR = /[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]/;

/** 150 palabras por minuto a ritmo 1, ~6 caracteres por palabra. */
const CHARS_PER_MIN_AT_RATE_1 = 150 * 6;

function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/**
 * Inicio de la palabra que contiene `charIndex`.
 * Un índice en un espacio o en puntuación pasa a la palabra siguiente.
 * Fuera del texto, devuelve 0 o `text.length`.
 */
export function wordStartAt(text: string, charIndex: number): number {
  const src = String(text ?? '');
  const n = src.length;
  if (n === 0) return 0;
  if (!Number.isFinite(charIndex)) return 0;
  let i = Math.floor(charIndex);
  if (i <= 0) return 0;
  if (i >= n) return n;
  if (isWordChar(src.charAt(i))) {
    while (i > 0 && isWordChar(src.charAt(i - 1))) i--;
    return i;
  }
  while (i < n && !isWordChar(src.charAt(i))) i++;
  return i;
}

/**
 * Texto que queda por decir desde la palabra actual.
 * `charIndex` 0 (aún no hubo avance) devuelve el texto entero.
 */
export function resumeSpeakText(text: string, charIndex: number): string {
  const src = String(text ?? '');
  if (!src) return '';
  const start = wordStartAt(src, charIndex);
  if (start <= 0) return src;
  if (start >= src.length) return '';
  return src.slice(start);
}

/**
 * Cursor aproximado cuando el motor no informa el límite
 * (plugin nativo, o `onboundary` que se queda en 0).
 * Cae en el inicio de una palabra.
 */
export function estimateSpeakCharIndex(
  text: string,
  elapsedMs: number,
  rate: number,
): number {
  const src = String(text ?? '');
  if (!src || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const pace = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const chars = Math.floor((elapsedMs / 60000) * CHARS_PER_MIN_AT_RATE_1 * pace);
  return wordStartAt(src, Math.min(src.length, Math.max(0, chars)));
}
