/**
 * One content.json unit. Pack JSON omits index_array; the reader stamps it on load.
 */
export interface CorpusUnit {
  consecutivo: string;
  contenido: string;
  referencias?: Reference[];
  index_array?: number;
  biblia?: {
    consecutivo_versiculo: string;
    versiculo: number;
    capitulo: string;
    libro: string;
    index_general: string;
  };
}

/** @deprecated Misspelled name. Use CorpusUnit. Kept for one release. */
export type TrasnportData = CorpusUnit;

export interface Reference {
  descripcion: string;
  url?: string;
  local?: {
    idDocumento: string;
    idPunto: string;
  };
  resolvedAtoms?: Array<{
    raw: string;
    kind: string;
    bookSlug?: string;
    chapter?: number;
    verse?: number;
    idPunto?: string;
  }>;
}

export interface BibleBook {
    _capitulo: string;
    _libro: string;
    _testamento: string;
    document:Document

}
