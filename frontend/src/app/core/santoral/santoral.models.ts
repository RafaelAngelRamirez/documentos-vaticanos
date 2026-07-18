/**
 * Offline santoral pack — saint records linked to corpus documentIds.
 * Aligned with scripts-descarga/models/santoral.model.ts.
 */

export interface SaintRecord {
  /** Stable slug id (e.g. agustin-hipona). */
  id: string;
  /** Canonical display name without obligatory "San/Santa" prefix. */
  name: string;
  /** Full liturgical / common name when different (e.g. San Agustín de Hipona). */
  displayName?: string;
  /** Feast day(s) as MM-DD (Gregorian general calendar when known). */
  feastDays?: string[];
  years?: string;
  death?: string;
  role?: string;
  /** Plain-text biography (from vatican.va or curated seed). */
  bio?: string;
  /** Holy See / vatican.va source page used for the bio. */
  sourceUrl?: string;
  locale?: string;
  /**
   * Alternate author strings that map corpus DocumentMeta.author → this saint.
   * e.g. ["Agustín de Hipona", "San Agustín", "Augustine of Hippo"].
   */
  authorAliases?: string[];
  /**
   * Explicit corpus document ids (works). Also expanded at resolve-time via author match.
   */
  documentIds?: string[];
  themes?: string[];
  quote?: string;
  quoteSource?: string;
  era?: string;
  eraLabel?: string;
  initials?: string;
  /** Compact list subtitle (years · role). */
  meta?: string;
}

export interface SantoralManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  saints: SaintRecord[];
}

/** Minimal document shape used by resolve helpers. */
export interface SantoralDocRef {
  id: string;
  title?: string;
  author?: string;
}
