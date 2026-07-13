/**
 * Multi-source scraper adapter contracts.
 * Content units stay Article / TransportData-compatible for the Angular UI.
 */

import type { TrasnportData } from "../../models/transport_data.model";

/** One entry from config/sources.json */
export interface SourceConfig {
  id: string;
  title: string;
  shortTitle: string;
  kind: string;
  locale: string;
  /** Target corpus document id, e.g. lg-es */
  corpusDocId: string;
  /** Optional code in models/data/doc-codes.json (LG, CIC, …) */
  docCode?: string;
  /** Registry key → SourceAdapter.id */
  adapter: string;
  seedUrls: string[];
  /** Relative to scripts-descarga/ for offline HTML */
  fixturePath?: string;
  expectedUnitCount?: number;
  legacyScript?: string;
  notes?: string;
  /** Author of the work (Church Father, etc.). */
  author?: string;
  /** Compiler / curator of the digital collection. */
  compiler?: string;
  /** Provenance note (edition, collection). */
  sourceNote?: string;
}

export interface SourcesFile {
  schemaVersion: number;
  description?: string;
  sources: SourceConfig[];
}

/** Result of parsing one HTML page into corpus units. */
export interface ParsedPage {
  /** Article-like body units (consecutivo + contenido + optional refs). */
  units: TrasnportData[];
  /** Extra URLs discovered on the page (for multi-page sources). */
  discoveredUrls?: string[];
  /** Optional structural headings (chapters, etc.). */
  headings?: string[];
  /** Free-form diagnostics for logs. */
  meta?: Record<string, unknown>;
}

export interface AdapterContext {
  /** Prefer fixture / offline when true. */
  offline?: boolean;
  /** Override fixture absolute path from CLI. */
  fixtureAbsPath?: string;
}

/**
 * Pluggable source parser.
 *
 * - expandSeeds: optional multi-page discovery from seeds
 * - parsePage: required HTML → units
 * - finalize: optional post-merge cleanup / ordering
 * - supportsLiveScrape: when false, CLI tells user to use legacyScript
 */
export interface SourceAdapter {
  id: string;
  /** Whether scrape_source can run a full live pipeline for this source. */
  supportsLiveScrape: boolean;
  expandSeeds?(
    seeds: string[],
    config: SourceConfig,
    ctx?: AdapterContext,
  ): Promise<string[]> | string[];
  parsePage(
    html: string,
    url: string,
    config: SourceConfig,
    ctx?: AdapterContext,
  ): ParsedPage | Promise<ParsedPage>;
  finalize?(
    units: TrasnportData[],
    config: SourceConfig,
    ctx?: AdapterContext,
  ): TrasnportData[] | Promise<TrasnportData[]>;
}
