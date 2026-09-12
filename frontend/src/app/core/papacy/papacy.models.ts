/**
 * Offline papacy pack — aligned with scripts-descarga/models/papacy.model.ts.
 */

export type PapalHonor = 'saint' | 'blessed' | 'venerable' | 'none';

export type PapalDocumentGenre =
  | 'apostolic-letter'
  | 'encyclical'
  | 'apostolic-exhortation'
  | 'apostolic-constitution'
  | 'motu-proprio'
  | 'bull'
  | 'letter'
  | 'other';

export interface PapalWorkRef {
  title: string;
  documentId?: string;
  sourceUrl?: string;
  genre?: PapalDocumentGenre;
  date?: string;
  locale?: string;
  place?: string;
  inCorpus?: boolean;
}

export interface PopeRecord {
  id: string;
  ordinal: number;
  name: string;
  displayName?: string;
  secularName?: string;
  birthplace?: string;
  reignStart?: string;
  reignEnd?: string;
  century?: number;
  years?: string;
  vaticanSlug?: string;
  vaticanPath?: string;
  contentSlug?: string;
  saintId?: string;
  honor?: PapalHonor;
  feastDays?: string[];
  bio?: string;
  sourceUrl?: string;
  locale?: string;
  era?: string;
  eraLabel?: string;
  initials?: string;
  meta?: string;
  documentIds?: string[];
  works?: PapalWorkRef[];
  see?: string;
  sourceNote?: string;
}

export interface PapacyManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  sourceUrl?: string;
  popes: PopeRecord[];
}

export interface PapacyDocRef {
  id: string;
  title?: string;
  sourceUrl?: string;
}
