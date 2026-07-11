export type DocumentKind = 'catechism' | 'bible' | string;

export interface DocumentMeta {
  id: string;
  title: string;
  shortTitle?: string;
  kind: DocumentKind;
  /** Optional locale from corpus pack. */
  locale?: string;
  /**
   * Path to body JSON. May be relative to the corpus root
   * (`documents/...`) or an absolute assets path (`assets/...`).
   */
  bodyPath: string;
  /**
   * Path to index JSON. Same resolution rules as bodyPath.
   */
  indexPath: string;
  unitCount?: number;
}

export interface CorpusManifest {
  version: number | string;
  generatedAt?: string;
  documents: DocumentMeta[];
}

export interface Referencia {
  descripcion: string;
  url: string;
  local: {
    idDocumento: string;
    idPunto: string;
  };
}

export interface Article {
  /**
   * Index position inside the articles array.
   * Stamped on first load to ease navigation between components.
   */
  index_array: number;
  consecutivo: string;
  contenido: string;
  referencias?: Referencia[];
  biblia?: {
    consecutivo_versiculo: string;
    versiculo: number;
    capitulo: string;
    libro: string;
    index_general: string;
  };
}

export interface Indice {
  indice: {
    [key: string]: number[];
  };

  /**
   * Key: array index of the article.
   * Value: point / consecutive number (or null).
   */
  indice_por_punto: {
    [key: number]: number | null;
  };
}

/**
 * Backward-compatible shape used by existing UI consumers.
 */
export interface IndiceDocumentos {
  /** Document id (stable). */
  id?: string;
  /** Display name (historically `nombre`). */
  nombre: string;
  documento: Article[];
  indice: Indice;
}

export interface LoadedDocument {
  meta: DocumentMeta;
  documento: Article[];
  indice: Indice;
}
