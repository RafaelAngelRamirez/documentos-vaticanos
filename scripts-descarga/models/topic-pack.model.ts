/**
 * Topic-search pack schema (build pipeline).
 * Mirror of frontend/src/app/core/search/topic-pack.models.ts — keep aligned.
 */

export type RelatedEvidenceReason = 'ref' | 'topic' | 'lexical';

export interface TopicSearchRootManifest {
  version: string;
  schema: number;
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
  edges: Record<string, UnitGraphEdge[]>;
}

export interface UnitTopicsFile {
  version: number;
  locale: string;
  units: Record<
    string,
    Array<{ topicId: string; conf: number; source?: string }>
  >;
}

/** Hard caps for v1 ES pack (CI must enforce). */
export const TOPIC_PACK_CAPS_V1 = {
  maxTopics: 250,
  maxPostingsPerTopic: 200,
  maxRawBytes: 12_000_000,
  maxGzipBytes: 4_000_000,
  maxRelatedHubs: 40,
  indexLoadConcurrency: 6,
  bodyLoadConcurrency: 4,
} as const;
