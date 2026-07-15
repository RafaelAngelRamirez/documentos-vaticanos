/**
 * Crawl graph types — separate from reading corpus units.
 */

export type PageType =
  | "hub-organ"
  | "doc-index"
  | "document"
  | "chrome"
  | "asset"
  | "external"
  | "unknown";

export type NodeStatus =
  | "queued"
  | "fetched"
  | "cataloged"
  | "skipped-corpus"
  | "skipped-blocked"
  | "skipped-locale"
  | "error"
  | "external";

export interface CrawlSeed {
  id: string;
  title: string;
  url: string;
  locale?: string;
  kind?: string;
  notes?: string;
}

export interface CrawlDefaults {
  maxDepth: number;
  concurrency: number;
  preferLocales: string[];
  allowHosts: string[];
  catalogExternal: boolean;
  expandExternal: boolean;
}

export interface CrawlSeedsFile {
  schemaVersion: number;
  description?: string;
  defaults: CrawlDefaults;
  seeds: CrawlSeed[];
}

export interface GraphNode {
  url: string;
  normalizedUrl: string;
  depth: number;
  parentUrl: string | null;
  pageType: PageType;
  locale: string | null;
  title: string | null;
  contentHash: string | null;
  fetchedAt: string | null;
  httpStatus: number | null;
  outLinks: number;
  status: NodeStatus;
  error?: string;
  linkText?: string;
}

export interface QueueItem {
  url: string;
  depth: number;
  parentUrl: string | null;
  linkText?: string;
  /** When true, do not fetch body (catalog only). */
  catalogOnly?: boolean;
}

export interface CrawlState {
  version: number;
  seedId: string;
  seedUrl: string;
  maxDepth: number;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  queue: QueueItem[];
  visited: string[];
  stats: CrawlStats;
}

export interface CrawlStats {
  fetched: number;
  cataloged: number;
  skippedCorpus: number;
  skippedBlocked: number;
  skippedLocale: number;
  external: number;
  errors: number;
  byPageType: Record<string, number>;
}

export interface OrganNode {
  id: string;
  title: string;
  sourceUrl: string;
  depth: number;
  documentIndexUrls: string[];
  children: OrganNode[];
}

export interface OrganTree {
  version: number;
  seedId: string;
  generatedAt: string;
  root: OrganNode;
}

export interface DiscoveryLocale {
  url: string;
  status: "discovered" | "cataloged" | "fetched" | "already-in-corpus";
  contentHash?: string | null;
}

export interface DiscoveryDocument {
  id: string;
  title: string | null;
  kind: string;
  organId: string | null;
  locales: Record<string, DiscoveryLocale>;
  preferredLocale: string | null;
  corpusDocId: string | null;
  sourceUrls: string[];
}

export interface DiscoveriesFile {
  version: number;
  seedId: string;
  generatedAt: string;
  documents: DiscoveryDocument[];
}
