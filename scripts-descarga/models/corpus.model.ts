/**
 * Versioned corpus schema for offline document packs.
 * content.json keeps Article-compatible shape for the Angular UI.
 */

/** Known document kinds; open string allows future packs. */
export type DocumentKind = "catechism" | "bible" | string;

/**
 * Per-document metadata. Paths are relative to the corpus root
 * (e.g. `documents/cic-es/content.json`).
 */
export interface DocumentMeta {
  id: string;
  title: string;
  shortTitle: string;
  kind: DocumentKind;
  locale: string;
  /** Official source URL for this locale (e.g. vatican.va). */
  sourceUrl?: string;
  /**
   * Author of the work (e.g. Church Father). Distinct from modern editors.
   */
  author?: string;
  /**
   * Compiler / curator of the digital pack (e.g. "A. Cedano").
   */
  compiler?: string;
  /**
   * Human-readable provenance (edition, collection, notes).
   */
  sourceNote?: string;
  /** Relative path to body JSON (Article[]). */
  bodyPath: string;
  /** Relative path to index JSON ({ indice, indice_por_punto }). */
  indexPath: string;
  /** Number of units in content.json when known. */
  unitCount?: number;
}

/**
 * Top-level corpus manifest shipped as manifest.json.
 */
export interface CorpusManifest {
  /** Schema / pack version string (semver-ish). */
  version: string;
  /** ISO timestamp when this pack was last written by the migrator. */
  generatedAt?: string;
  documents: DocumentMeta[];
}

/**
 * Search index packed next to content.json.
 * Same shape the UI already expects (Indice).
 */
export interface CorpusIndex {
  indice: {
    [term: string]: number[];
  };
  /**
   * Key = array index in content.json;
   * value = paragraph/verse number (consecutivo) when numeric.
   */
  indice_por_punto: {
    [arrayIndex: number]: number | null;
  };
}
