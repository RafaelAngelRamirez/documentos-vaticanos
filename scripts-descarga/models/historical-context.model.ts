/**
 * Offline historical-context pack schema (dual-written next to corpus).
 * Keep aligned with frontend historical-context-resolve.logic.ts.
 *
 * Two layers:
 *  1) Author/era/issuer profile (general place, government, culture, …)
 *  2) Per-document overlay (composition window + chronology slice)
 *
 * Citations: each block of prose can point to reference ids (`summaryRefIds`,
 * `axisSources`, `workSummaryRefIds`, …). The full bibliography lives in
 * `references[]` (with stable `id` for linking).
 */

/** The eight required historical axes (non-empty text in resolved context). */
export interface ContextAxes {
  lugar: string;
  personajes: string;
  gobierno: string;
  cultura: string;
  religion: string;
  antropologia: string;
  creenciasMundanas: string;
  creenciaCristiana: string;
}

/** Map axis → reference ids that support that axis text. */
export type AxisSourceMap = Partial<Record<keyof ContextAxes, string[]>>;

/** Citable source for context claims. */
export interface ContextReference {
  /**
   * Stable id used by summaryRefIds / axisSources / timeline.refIds.
   * Prefer short kebab keys shared across the pack (e.g. `brown-ag`).
   */
  id?: string;
  title: string;
  citation?: string;
  url?: string;
  /** How this source was used (e.g. "biografía y datación"). */
  note?: string;
  /** Page, chapter, DH number, session, etc. */
  locator?: string;
}

export interface TimelineEntry {
  years: string;
  label: string;
  note?: string;
  /** Reference ids supporting this timeline row. */
  refIds?: string[];
}

export interface AuthorContextProfile {
  id: string;
  name: string;
  kind: 'author' | 'era' | 'issuer';
  years?: string;
  summary: string;
  /** Refs that support `summary`. */
  summaryRefIds?: string[];
  axes: ContextAxes;
  /** Per-axis reference ids (dense citation). */
  axisSources?: AxisSourceMap;
  timeline?: TimelineEntry[];
  references: ContextReference[];
  sourceNote?: string;
  saintId?: string;
}

export interface DocumentContextOverlay {
  documentId: string;
  authorProfileId?: string;
  compositionYears?: string;
  compositionPlace?: string;
  workSummary?: string;
  workSummaryRefIds?: string[];
  chronologyNote?: string;
  chronologyRefIds?: string[];
  axes?: Partial<ContextAxes>;
  /** Work-specific axis sources (override author for that axis when set). */
  axisSources?: AxisSourceMap;
  timelineSlice?: TimelineEntry[];
  references?: ContextReference[];
  sourceNote?: string;
}

export interface ResolvedHistoricalContext {
  documentId: string;
  authorProfileId?: string;
  authorName?: string;
  saintId?: string;
  compositionYears?: string;
  compositionPlace?: string;
  generalSummary?: string;
  summaryRefIds?: string[];
  workSummary?: string;
  workSummaryRefIds?: string[];
  chronologyNote?: string;
  chronologyRefIds?: string[];
  axes: ContextAxes;
  axisSources: AxisSourceMap;
  timeline: TimelineEntry[];
  references: ContextReference[];
  sourceNote?: string;
}

export interface HistoricalContextManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  authors: { id: string; path: string }[];
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

export const HISTORICAL_CONTEXT_MANIFEST_URL =
  'assets/corpus/context/manifest.json';
