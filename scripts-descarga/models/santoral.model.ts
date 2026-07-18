/**
 * Offline santoral pack schema (dual-written next to corpus).
 * Keep aligned with frontend/src/app/core/santoral/santoral.models.ts.
 */

export interface SaintRecord {
  id: string;
  name: string;
  displayName?: string;
  feastDays?: string[];
  years?: string;
  death?: string;
  role?: string;
  bio?: string;
  sourceUrl?: string;
  locale?: string;
  authorAliases?: string[];
  documentIds?: string[];
  themes?: string[];
  quote?: string;
  quoteSource?: string;
  era?: string;
  eraLabel?: string;
  initials?: string;
  meta?: string;
}

export interface SantoralManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  saints: SaintRecord[];
}
