import { EventEmitter, Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  parseSearchInput,
  type ParsedSearch,
} from 'src/app/core/search/semantic-search.logic';
import { parseTopicQuery } from 'src/app/core/search/topic-query.logic';

export interface BuscarOptions {
  /** Route `mode=topic` or equivalent. */
  mode?: string | null;
  /** Route `slug` or `topic` for thematic mode. */
  slug?: string | null;
  topic?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class BuscadorService {
  constructor() {}
  global_control_search_input!: FormControl;

  terminos: TermsProcessed = {};
  terminos_emit = new EventEmitter<TermsProcessed>();

  buscar(v: string | null, opts?: BuscarOptions) {
    if (v || opts?.mode === 'topic' || opts?.slug || opts?.topic) {
      this.terminos = this.procesar_cadena_de_terminos(v ?? '', opts);
    } else {
      this.terminos = {};
    }
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
   *  5. Modo temático (PR5).
   *    - tema:gracia · mode=topic&slug=gracia
   *
   * @param {string} t El termino
   * @memberof BuscadorService
   */
  procesar_cadena_de_terminos(t: string, opts?: BuscarOptions): TermsProcessed {
    const topicQ = parseTopicQuery(t, opts);
    if (topicQ.mode === 'topic' && topicQ.slug) {
      const lexicalRaw = topicQ.lexicalRaw;
      const parsed = lexicalRaw
        ? parseSearchInput(lexicalRaw)
        : parseSearchInput(topicQ.slug);
      const base = termsFromParsed(
        // Keep topic mode even if lexical parse of slug is empty-ish
        parsed.empty && !lexicalRaw
          ? {
              empty: false,
              phrases: [topicQ.slug],
              contentTerms: [topicQ.slug.toLowerCase()],
              points: [],
            }
          : parsed,
        t || topicQ.slug,
      );
      return {
        ...base,
        mode: 'topic',
        topicSlug: topicQ.slug,
        rawQuery: t || topicQ.slug,
      };
    }

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
  /** PR5: thematic search mode from `tema:` or route `mode=topic`. */
  mode?: 'topic' | 'lexical';
  /** PR5: topic slug or id when mode === 'topic'. */
  topicSlug?: string;
}
