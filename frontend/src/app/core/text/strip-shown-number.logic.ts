/**
 * Quita solo el número inicial del cuerpo cuando es exactamente el versículo
 * o el párrafo que el lector ya muestra al lado.
 *
 * El corpus no se reescribe. La misma función, aplicada dos veces, no cambia
 * más texto. Un «5a», un «20» o un «2» a mitad de frase se quedan.
 */
import { headingLevel } from '../../services/speech-prep.logic';

/** Dígitos, o dígitos más una letra (12, 12a). */
const NUMBER_TOKEN = /^\d+[a-zA-Z]?$/;

/**
 * «1 Tm 3», «1 Cro 11», «1 Jn ii». El 1 es el libro, no la etiqueta.
 * El capítulo tiene que ser el token entero: «víctima» no cuenta como «v».
 */
const SCRIPTURE_CITE =
  /^\s+[A-Za-z]{1,4}(?![A-Za-z])\.?\s+(?:\d+|(?:xii|xi|x|ix|viii|vii|vi|iv|iii|ii|i|v)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ]))/i;

export interface ShownNumberUnit {
  contenido?: string | null;
  consecutivo?: string | null;
  biblia?: {
    versiculo?: number | null;
    consecutivo_versiculo?: string | null;
  } | null;
}

/**
 * Número que el cromo ya pinta.
 * Biblia: el versículo de «Sal 15, 2», no el índice global.
 * Resto: el consecutivo cuando es un numeral de párrafo.
 */
export function shownParagraphNumber(unit: ShownNumberUnit | null | undefined): string | null {
  const bib = unit?.biblia;
  const cite = bib?.consecutivo_versiculo?.trim() ?? '';
  if (cite && bib && bib.versiculo != null) {
    const verse = Number(bib.versiculo);
    if (Number.isInteger(verse) && verse >= 0) return String(verse);
  }
  const consecutivo = String(unit?.consecutivo ?? '').trim();
  if (!consecutivo || consecutivo === 'no-encontrado') return null;
  if (NUMBER_TOKEN.test(consecutivo)) return consecutivo;
  return null;
}

/**
 * Si el cuerpo empieza por `shown` como token entero, lo quita junto con el
 * separador de etiqueta (espacio, «. », «, », «) », «: »). No come «5a»,
 * «20» ni «12,000». Una elipsis «15...» pierde el 15 y conserva «...».
 */
export function stripExactShownNumber(
  text: string,
  shown: string | null | undefined,
): string {
  const n = String(shown ?? '').trim();
  if (!NUMBER_TOKEN.test(n)) return String(text ?? '');
  const src = String(text ?? '');
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '^(\\s*)' + esc + '(?=\\s|$|[.,:)](?:\\s|$)|\\.{3})',
  );
  const match = re.exec(src);
  if (!match) return src;
  const rest = src.slice(match[0].length);
  if (/^\s/.test(rest) && SCRIPTURE_CITE.test(rest)) return src;
  if (rest.startsWith('...')) return rest;
  if (/^[.,:)](?:\s|$)/.test(rest)) return rest.replace(/^[.,:)]\s*/, '');
  return rest.replace(/^\s+/, '');
}

/**
 * Cuerpo que se pinta junto a la etiqueta. Un título estructural no lleva
 * numeral aparte, así que su número inicial se conserva.
 */
export function displayBody(unit: ShownNumberUnit | null | undefined): string {
  const raw = String(unit?.contenido ?? '');
  if (headingLevel(raw, { consecutivo: unit?.consecutivo ?? null }) > 0) {
    return raw;
  }
  return stripExactShownNumber(raw, shownParagraphNumber(unit));
}
