export type DocumentKind = 'catechism' | 'bible' | string;

export interface DocumentMeta {
  id: string;
  /** Full display title (prefer over shortTitle in UI). */
  title: string;
  /** Abbreviation / legacy short label (DV, LG, CIC…). */
  shortTitle?: string;
  kind: DocumentKind;
  /** BCP-47-ish locale of this pack (e.g. `es`). */
  locale?: string;
  /**
   * Official source page for this locale (typically vatican.va).
   * UI should link language label here.
   */
  sourceUrl?: string;
  /** Author of the work (e.g. Church Father). */
  author?: string;
  /** Compiler / curator of the digital pack (e.g. A. Cedano). */
  compiler?: string;
  /** Human-readable provenance (edition, collection). */
  sourceNote?: string;
  /** Whether this pack is an official edition or an AI translation sibling. */
  translationProvenance?: 'official' | 'ai';
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
  url?: string;
  local?: {
    idDocumento: string;
    /** Array index preferred (stringified number), or consecutivo. */
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
  /** Display name (full title preferred). */
  nombre: string;
  /** Full official title when known. */
  title?: string;
  /** Abbreviation for compact UI. */
  shortTitle?: string;
  locale?: string;
  /** Official source URL for the document language. */
  sourceUrl?: string;
  documento: Article[];
  indice: Indice;
}

export interface LoadedDocument {
  meta: DocumentMeta;
  documento: Article[];
  indice: Indice;
}
