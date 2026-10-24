/**
 * Offline topic-search pack types (sibling of reading corpus under assets/corpus/search/).
 * Mirror of scripts-descarga/models/topic-pack.model.ts — keep aligned.
 *
 * Runtime: HTTP + in-memory cache (HistoricalContext pattern). Missing pack → degrade.
 * Citations always use documentId + unitIndex.
 */

/** Why a related citation was suggested (ranking / UI chips). */
export type RelatedEvidenceReason = 'ref' | 'topic' | 'lexical';

export const TOPIC_SEARCH_ROOT = 'assets/corpus/search';
export const TOPIC_SEARCH_MANIFEST_URL = `${TOPIC_SEARCH_ROOT}/search-manifest.json`;

/** Root index of locale packs (optional multi-locale scaffolding). */
export interface TopicSearchRootManifest {
  version: string;
  schema: number;
  /** locale → relative path to locale pack dir (e.g. "es" → "es"). */
  locales: Record<string, string>;
  sourceNote?: string;
}

export interface TopicPackManifest {
  version: string;
  schema: number;
  locale: string;
  generatedAt: string;
  corpusFingerprint: {
    algo: 'sha256';
    value: string;
    docCount: number;
  };
  caps: {
    maxTopics: number;
    maxPostingsPerTopic: number;
    maxRawBytes: number;
  };
  topicCount: number;
  edgeCount?: number;
  files: {
    topics: string;
    postings: string;
    termTopics: string;
    graph?: string;
    docGraph?: string;
    unitTopics?: string;
  };
  sourceNote?: string;
}

export interface TopicRecord {
  id: string;
  slug: string;
  label: string;
  aliases?: string[];
  parentId?: string | null;
  relatedIds?: string[];
  kind: 'seed' | 'discovered';
  unitCount?: number;
  documentCount?: number;
}

export interface TopicCitation {
  documentId: string;
  unitIndex: number;
  conf: number;
  consecutivo?: string;
}

export interface TopicPostingsFile {
  version: number;
  locale: string;
  postings: Record<string, TopicCitation[]>;
}

export interface TermTopicsFile {
  version: number;
  locale: string;
  terms: Record<string, Array<{ topicId: string; w: number }>>;
}

export interface UnitGraphEdge {
  documentId: string;
  unitIndex: number;
  weight: number;
  type: 'ref' | 'ref-reciprocal';
}

export interface UnitGraphFile {
  version: number;
  locale: string;
  /** key = `${documentId}:${unitIndex}` */
  edges: Record<string, UnitGraphEdge[]>;
}

/** Compact document↔document citation map (build-time rollup of unit-graph). */
export interface DocGraphSample {
  fromUnit: number;
  toUnit: number;
}

export interface DocGraphEdge {
  documentId: string;
  count: number;
  back?: number;
  w: number;
  samples: DocGraphSample[];
}

export interface DocGraphNode {
  id: string;
  title: string;
  shortTitle: string;
  kind: string;
  inDegree: number;
  outDegree: number;
  x: number;
  y: number;
}

export interface DocGraphFile {
  version: number;
  locale: string;
  generatedFrom?: string;
  nodes: DocGraphNode[];
  edges: Record<string, DocGraphEdge[]>;
}

export function emptyDocGraph(locale: string): DocGraphFile {
  return { version: 1, locale, nodes: [], edges: {} };
}

export interface UnitTopicsFile {
  version: number;
  locale: string;
  units: Record<
    string,
    Array<{ topicId: string; conf: number; source?: string }>
  >;
}

/** Fully loaded pack for one locale (any file may be empty). */
export interface TopicPack {
  manifest: TopicPackManifest;
  topics: TopicRecord[];
  postings: TopicPostingsFile;
  termTopics: TermTopicsFile;
  graph: UnitGraphFile | null;
  docGraph: DocGraphFile | null;
  unitTopics: UnitTopicsFile | null;
}

/** Empty pack used when assets are missing (UI must not crash). */
export function emptyTopicPack(locale: string): TopicPack {
  return {
    manifest: {
      version: '0',
      schema: 1,
      locale,
      generatedAt: '',
      corpusFingerprint: { algo: 'sha256', value: '', docCount: 0 },
      caps: {
        maxTopics: 250,
        maxPostingsPerTopic: 200,
        maxRawBytes: 12_000_000,
      },
      topicCount: 0,
      files: {
        topics: 'topics.json',
        postings: 'topic-postings.json',
        termTopics: 'term-topics.json',
      },
      sourceNote: 'Topic pack not available',
    },
    topics: [],
    postings: { version: 1, locale, postings: {} },
    termTopics: { version: 1, locale, terms: {} },
    graph: null,
    docGraph: null,
    unitTopics: null,
  };
}

export function unitKey(documentId: string, unitIndex: number): string {
  return `${documentId}:${unitIndex}`;
}
