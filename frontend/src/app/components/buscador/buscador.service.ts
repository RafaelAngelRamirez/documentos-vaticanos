import { EventEmitter, Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  parseSearchInput,
  type ParsedSearch,
} from 'src/app/core/search/semantic-search.logic';

@Injectable({
  providedIn: 'root',
})
export class BuscadorService {
  constructor() {}
  global_control_search_input!: FormControl;

  terminos: TermsProcessed = {};
  terminos_emit = new EventEmitter<TermsProcessed>();

  buscar(v: string | null) {
    if (v) this.terminos = this.procesar_cadena_de_terminos(v);
    else this.terminos = {};
    this.terminos_emit.emit(this.terminos);
  }

  /**
   * Separamos los terminos por comas, que deben ser
   * terminos completos, y por puntos, que deben iniciar
   * por un punto. Ejemlos.
   *  1. Terminos textuales.
   *    - catecismo, cristo, cruz
   *  2. Busqueda por puntos.
   *    - .123, .3455-3460
   *  3. Terminos textuales y busqueda por puntos.
   *    - catecismo, .200-205, .1000
   *  4. Frases / intenciones (multi-palabra, sin comas).
   *    - el amor de Dios  → contentTerms: amor, dios
   *
   * @param {string} t El termino
   * @memberof BuscadorService
   */
  procesar_cadena_de_terminos(t: string): TermsProcessed {
    const parsed = parseSearchInput(t);
    return termsFromParsed(parsed, t);
  }
}

export function termsFromParsed(
  parsed: ParsedSearch,
  raw?: string,
): TermsProcessed {
  if (parsed.empty) {
    return { terminos: [], contentTerms: [], puntos: [], rawQuery: raw ?? '' };
  }
  return {
    terminos: parsed.phrases.length ? [...parsed.phrases] : undefined,
    contentTerms: [...parsed.contentTerms],
    puntos: parsed.points.length ? [...parsed.points] : undefined,
    rawQuery: raw ?? parsed.phrases.join(', '),
  };
}

export interface TermsProcessed {
  /** Raw phrase clauses (comma-separated text), for display / highlight seeds. */
  terminos?: string[];
  /**
   * Folded content tokens after stopword removal (intention / multi-word).
   * Used by semantic ranking; may be empty when only `.punto` clauses.
   */
  contentTerms?: string[];
  puntos?: number[];
  /** Original query string when available. */
  rawQuery?: string;
}
