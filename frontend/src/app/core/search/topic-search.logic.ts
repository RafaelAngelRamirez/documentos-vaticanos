/**
 * Pure helpers for topic pack ranking / membership (no Angular).
 * Self-contained for node strip-types tests (no sibling runtime imports).
 */

export type RelatedEvidenceReason = 'ref' | 'topic' | 'lexical';

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

export interface TopicPackLike {
  manifest: { locale: string };
  topics: TopicRecord[];
  postings: TopicPostingsFile;
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

/** Minimal hit shape for boost (compatible with RankedUnitHit). */
export interface BoostableHit {
  documentId: string;
  unitIndex: number;
  score: number;
  [key: string]: unknown;
}

export function unitKey(documentId: string, unitIndex: number): string {
  return `${documentId}:${unitIndex}`;
}

/** Build membership sets: topicId → Set of "docId:unitIndex". */
export function membershipFromPostings(
  postings: TopicPostingsFile,
  topicIds: string[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const tid of topicIds) {
    const list = postings.postings[tid] || [];
    const set = new Set<string>();
    for (const c of list) {
      if (c?.documentId != null && Number.isFinite(c.unitIndex)) {
        set.add(unitKey(c.documentId, c.unitIndex));
      }
    }
    out.set(tid, set);
  }
  return out;
}

/**
 * Soft boost lexical hits that appear in query topics' postings.
 * α default 0.25; conf from optional map or citation conf default 1.
 */
export function boostHitsWithTopics<T extends BoostableHit>(
  hits: T[],
  membership: Map<string, Set<string>>,
  queryTopicIds: string[],
  confByKey?: Map<string, number>,
  alpha = 0.25,
): T[] {
  if (!hits.length || !queryTopicIds.length || !membership.size) {
    return hits;
  }
  return hits.map((h) => {
    const key = unitKey(h.documentId, h.unitIndex);
    let best = 0;
    for (const tid of queryTopicIds) {
      const set = membership.get(tid);
      if (!set || !set.has(key)) continue;
      const conf =
        confByKey?.get(`${tid}|${key}`) ?? confByKey?.get(key) ?? 1;
      best = Math.max(best, conf);
    }
    if (best <= 0) return h;
    return {
      ...h,
      score: Math.round(h.score * (1 + alpha * best) * 1000) / 1000,
    };
  });
}

/** Map topic slug/id → topic record from pack catalog. */
export function findTopic(
  pack: TopicPackLike | null | undefined,
  slugOrId: string,
): TopicRecord | null {
  if (!pack || !slugOrId) return null;
  const q = slugOrId.trim().toLowerCase();
  return (
    pack.topics.find(
      (t) =>
        t.slug.toLowerCase() === q ||
        t.id.toLowerCase() === q ||
        t.id.toLowerCase() === `topic:${pack.manifest.locale}:${q}`,
    ) || null
  );
}

/** Postings for a topic id (empty if missing). */
export function postingsForTopic(
  pack: TopicPackLike | null | undefined,
  topicId: string,
): TopicCitation[] {
  if (!pack || !topicId) return [];
  return pack.postings.postings[topicId] || [];
}

export function neighborsFromGraph(
  graph: UnitGraphFile | null | undefined,
  documentId: string,
  unitIndex: number,
): UnitGraphEdge[] {
  if (!graph?.edges) return [];
  return graph.edges[unitKey(documentId, unitIndex)] || [];
}

/** Prefer evidence reason for UI / merge (ref > topic > lexical). */
export function preferReason(
  a?: RelatedEvidenceReason,
  b?: RelatedEvidenceReason,
): RelatedEvidenceReason | undefined {
  const rank: Record<RelatedEvidenceReason, number> = {
    ref: 3,
    topic: 2,
    lexical: 1,
  };
  if (!a) return b;
  if (!b) return a;
  return rank[a] >= rank[b] ? a : b;
}

/** Minimal related row shape for merge (aligned with RelatedCitationRow). */
export interface RelatedRowLike {
  documentId: string;
  unitIndex: number;
  consecutivo?: string;
  score: number;
  title: string;
  snippet: string;
  matchedTerms: string[];
  reason?: RelatedEvidenceReason;
}

/**
 * Merge graph (ref) neighbors with lexical related rows.
 * Ref rows bypass lexical quality gates; sorted reason rank then score.
 */
export function mergeRelatedByEvidence(
  graphRows: RelatedRowLike[],
  lexicalRows: RelatedRowLike[],
  limit = 8,
): RelatedRowLike[] {
  const byKey = new Map<string, RelatedRowLike>();
  const keyOf = (r: RelatedRowLike) => `${r.documentId}:${r.unitIndex}`;

  for (const r of graphRows) {
    const k = keyOf(r);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...r, reason: r.reason || 'ref' });
      continue;
    }
    byKey.set(k, {
      ...prev,
      score: Math.max(prev.score, r.score),
      reason: preferReason(prev.reason, r.reason || 'ref'),
      snippet: prev.snippet || r.snippet,
      title: prev.title || r.title,
      matchedTerms: [
        ...new Set([...(prev.matchedTerms || []), ...(r.matchedTerms || [])]),
      ],
    });
  }

  for (const r of lexicalRows) {
    const k = keyOf(r);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...r, reason: r.reason || 'lexical' });
      continue;
    }
    byKey.set(k, {
      ...prev,
      score: Math.max(prev.score, r.score),
      reason: preferReason(prev.reason, r.reason || 'lexical'),
      snippet: prev.snippet?.length ? prev.snippet : r.snippet,
      title: prev.title || r.title,
      matchedTerms: [
        ...new Set([...(prev.matchedTerms || []), ...(r.matchedTerms || [])]),
      ],
    });
  }

  const rankReason = (r?: RelatedEvidenceReason) =>
    r === 'ref' ? 3 : r === 'topic' ? 2 : 1;

  return [...byKey.values()]
    .sort(
      (a, b) =>
        rankReason(b.reason) - rankReason(a.reason) ||
        b.score - a.score ||
        a.documentId.localeCompare(b.documentId) ||
        a.unitIndex - b.unitIndex,
    )
    .slice(0, limit);
}

/**
 * Build related rows from unit-graph neighbors (no lexical gate).
 * `docs` must include neighbor document packs for snippets when available.
 */
export function rowsFromGraphNeighbors(
  seedDocumentId: string,
  seedUnitIndex: number,
  neighbors: UnitGraphEdge[],
  docs: Array<{
    documentId: string;
    units?: Array<{ consecutivo?: string; contenido?: string }>;
  }>,
  opts: {
    excludeDocumentId?: string | null;
    limit?: number;
  } = {},
): RelatedRowLike[] {
  const byId = new Map(docs.map((d) => [d.documentId, d]));
  const limit = opts.limit ?? 8;
  const rows: RelatedRowLike[] = [];
  for (const e of neighbors) {
    if (opts.excludeDocumentId && e.documentId === opts.excludeDocumentId) {
      continue;
    }
    if (
      e.documentId === seedDocumentId &&
      e.unitIndex === seedUnitIndex
    ) {
      continue;
    }
    const doc = byId.get(e.documentId);
    const unit = doc?.units?.[e.unitIndex];
    const consec =
      unit?.consecutivo && unit.consecutivo !== 'no-encontrado'
        ? unit.consecutivo
        : String(e.unitIndex);
    const snippet = (unit?.contenido || '')
      .replace(/\[\+\[\d+\]\+\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    rows.push({
      documentId: e.documentId,
      unitIndex: e.unitIndex,
      consecutivo: unit?.consecutivo,
      score: 10 * (e.weight || 1) + (e.type === 'ref' ? 2 : 0),
      title: `${e.documentId} · Nº ${consec}`,
      snippet: snippet
        ? snippet.length >= 140
          ? snippet.slice(0, 139) + '…'
          : snippet
        : 'Cita enlazada en el corpus',
      matchedTerms: [],
      reason: 'ref',
    });
    if (rows.length >= limit) break;
  }
  return rows;
}
