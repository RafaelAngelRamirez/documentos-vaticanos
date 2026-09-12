/**
 * Offline papacy pack — every Roman pontiff, linked to santoral + corpus.
 * Keep aligned with frontend/src/app/core/papacy/papacy.models.ts.
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

/** Vatican.va (or corpus) work attributed to a pope. */
export interface PapalWorkRef {
  title: string;
  /** Corpus pack id when already imported. */
  documentId?: string;
  sourceUrl?: string;
  genre?: PapalDocumentGenre;
  /** Date string as published by vatican.va (not normalized). */
  date?: string;
  locale?: string;
  /** Place of issuance when known (Roma, Aviñón…). */
  place?: string;
  inCorpus?: boolean;
}

export interface PopeRecord {
  /** Stable slug (Spanish, santoral-aligned when the pope is a saint). */
  id: string;
  /** Annuario / vatican.va ordinal (Pedro = 1). */
  ordinal: number;
  /** Pontifical name as listed by the Holy See (ES). */
  name: string;
  displayName?: string;
  secularName?: string;
  birthplace?: string;
  reignStart?: string;
  reignEnd?: string;
  century?: number;
  /** Compact reign label for list rows. */
  years?: string;
  /** Basename of the vatican.va holy-father (or content hub) page. */
  vaticanSlug?: string;
  vaticanPath?: string;
  /**
   * Modern archive hub under /content/{slug}/ (francesco, john-paul-ii…).
   * Absent for popes who only have a holy-father profile page.
   */
  contentSlug?: string;
  /** Santoral saint id when this pope is listed there. */
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
  /** Corpus document ids issued by this pope (all locales). */
  documentIds?: string[];
  /** Catalogued vatican.va works (letters, encyclicals…) not necessarily in corpus. */
  works?: PapalWorkRef[];
  /** Usual see during the pontificate (Roma, Aviñón). */
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
