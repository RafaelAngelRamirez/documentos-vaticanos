/**
 * Offline historical-context pack schema (dual-written next to corpus).
 * Keep aligned with frontend/src/app/core/context/historical-context.models.ts.
 *
 * Two layers:
 *  1) Author/era/issuer profile (general place, government, culture, …)
 *  2) Per-document overlay (composition window + chronology slice)
 *
 * Resolution merges general + obra offline without I/O in the merge itself.
 */

/** The eight required historical axes (non-empty in resolved context). */
export interface ContextAxes {
  /** Geography / cities / regions of composition or setting. */
  lugar: string;
  /** Related historical persons (rulers, interlocutors, opponents…). */
  personajes: string;
  /** Political power structures of the period. */
  gobierno: string;
  /** Letters, arts, social forms, language. */
  cultura: string;
  /** Religious landscape (plural: cults, Judaism, Islam, reform…). */
  religion: string;
  /** Everyday life, kinship, status, body practices. */
  antropologia: string;
  /** Non-Christian or popular worldviews concurrent with the work. */
  creenciasMundanas: string;
  /** Dominant Christian confession / theological climate. */
  creenciaCristiana: string;
}

/** Citable source for context claims. */
export interface ContextReference {
  /** Work, article, or site title. */
  title: string;
  /** Bibliographic citation when no stable URL. */
  citation?: string;
  /** Stable URL when available (vatican.va, archive.org, …). */
  url?: string;
  /** Optional short note on how it was used. */
  note?: string;
}

export interface TimelineEntry {
  /** Human range, e.g. "397–400" or "s. IV". */
  years: string;
  label: string;
  note?: string;
}

/**
 * Reusable profile: Church Father, pope/issuer, council era, or cultural milieu.
 * Linked from many document overlays via `authorProfileId`.
 */
export interface AuthorContextProfile {
  id: string;
  name: string;
  /** author = person; era = epoch milieu; issuer = council/curia/pontificate. */
  kind: 'author' | 'era' | 'issuer';
  years?: string;
  /** Short entry-level summary shown above axes. */
  summary: string;
  axes: ContextAxes;
  timeline?: TimelineEntry[];
  references: ContextReference[];
  sourceNote?: string;
  /** Optional link to offline santoral saint id. */
  saintId?: string;
}

/**
 * Per-document overlay. Chronology specific to the work lives here so multi-obra
 * authors (e.g. Agustín) do not share an identical block.
 */
export interface DocumentContextOverlay {
  documentId: string;
  authorProfileId?: string;
  compositionYears?: string;
  compositionPlace?: string;
  /** Work-specific paragraph (why/when this book). */
  workSummary?: string;
  /** Where this book sits in the author's life or the era. */
  chronologyNote?: string;
  /** Optional overrides / specializations of the eight axes for this work. */
  axes?: Partial<ContextAxes>;
  timelineSlice?: TimelineEntry[];
  references?: ContextReference[];
  sourceNote?: string;
}

/** Result of pure merge(author, overlay) for UI. */
export interface ResolvedHistoricalContext {
  documentId: string;
  authorProfileId?: string;
  authorName?: string;
  saintId?: string;
  compositionYears?: string;
  compositionPlace?: string;
  generalSummary?: string;
  workSummary?: string;
  chronologyNote?: string;
  axes: ContextAxes;
  timeline: TimelineEntry[];
  references: ContextReference[];
  sourceNote?: string;
}

/** Top-level index of the offline context pack. */
export interface HistoricalContextManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  /** Path relative to pack root for each author profile. */
  authors: { id: string; path: string }[];
  /** Path relative to pack root for each document overlay. */
  documents: { documentId: string; path: string; authorProfileId?: string }[];
}

export const CONTEXT_AXES_KEYS: (keyof ContextAxes)[] = [
  'lugar',
  'personajes',
  'gobierno',
  'cultura',
  'religion',
  'antropologia',
  'creenciasMundanas',
  'creenciaCristiana',
];

/** Offline pack URL relative to app assets. */
export const HISTORICAL_CONTEXT_MANIFEST_URL =
  'assets/corpus/context/manifest.json';
