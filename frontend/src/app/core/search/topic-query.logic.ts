/**
 * Pure helpers for topic-aware query parsing and ranking boost (PR5).
 * Self-contained for node strip-types tests — no sibling runtime imports.
 *
 * Soft-degrades when term-topics / postings are empty (identity boost, empty topic hits).
 */

export type TopicQueryMode = 'lexical' | 'topic';

export interface TermTopicWeight {
  topicId: string;
  w: number;
}

export interface TermTopicsLike {
  terms: Record<string, TermTopicWeight[]>;
}

export interface TopicCitationLike {
  documentId: string;
  unitIndex: number;
  conf: number;
  consecutivo?: string;
}

export interface TopicPostingsLike {
  postings: Record<string, TopicCitationLike[]>;
}

export interface TopicRecordLike {
  id: string;
  slug: string;
  label: string;
  aliases?: string[];
}

export interface TopicPackQueryLike {
  manifest?: { locale?: string };
  topics: TopicRecordLike[];
  postings: TopicPostingsLike;
  termTopics: TermTopicsLike;
}

/** Minimal hit shape compatible with RankedUnitHit (no index signature). */
export interface TopicBoostableHit {
  documentId: string;
  unitIndex: number;
  score: number;
  consecutivo?: string;
  matchedTerms?: string[];
  highlightTerms?: string[];
}

export interface ParsedTopicQuery {
  mode: TopicQueryMode;
  /** slug or full topic id when mode === 'topic' */
  slug: string | null;
  /**
   * Free-text left for lexical ranking (raw minus `tema:` / `topic:` prefix when present).
   * Empty string when the whole query was a topic directive.
   */
  lexicalRaw: string;
}

export interface TopicBoostResult<T extends TopicBoostableHit> {
  hits: T[];
  topicIds: string[];
  boosted: boolean;
}

const TEMA_PREFIX = /^(?:tema|topic)\s*:\s*(.+)$/i;

/**
 * Fold a term like semantic foldToken: strip diacritics (keep ñ), lowercase, light clean.
 * Self-contained copy so this file needs no sibling imports under strip-types.
 */
export function foldTopicTerm(raw: string): string {
  if (raw == null) return '';
  const stripped = String(raw)
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize();
  return stripped
    .replace(/[,"\.«»“”:;!¡¿?—']/gi, '')
    .replace(/[\[\]”']/gi, '')
    .replace(/[-\(\)\*\/`‘–…]/gi, '')
    .toLowerCase()
    .trim();
}

/**
 * Parse topic mode from free text and/or route opts.
 * Priority: explicit mode=topic + slug/topic → `tema:slug` / `topic:slug` in raw → lexical.
 */
export function parseTopicQuery(
  raw: string | null | undefined,
  opts?: {
    mode?: string | null;
    slug?: string | null;
    topic?: string | null;
  },
): ParsedTopicQuery {
  const text = raw == null ? '' : String(raw).trim();
  const modeOpt = (opts?.mode || '').trim().toLowerCase();
  const slugOpt = (opts?.slug || opts?.topic || '').trim();

  if (modeOpt === 'topic' && slugOpt) {
    return {
      mode: 'topic',
      slug: slugOpt,
      lexicalRaw: text && text.toLowerCase() !== slugOpt.toLowerCase() ? text : '',
    };
  }

  if (modeOpt === 'topic' && text) {
    const m = text.match(TEMA_PREFIX);
    if (m) {
      return { mode: 'topic', slug: m[1]!.trim(), lexicalRaw: '' };
    }
    // mode=topic with only q → treat q as slug
    return { mode: 'topic', slug: text, lexicalRaw: '' };
  }

  const m = text.match(TEMA_PREFIX);
  if (m) {
    return { mode: 'topic', slug: m[1]!.trim(), lexicalRaw: '' };
  }

  if (slugOpt && !text) {
    return { mode: 'topic', slug: slugOpt, lexicalRaw: '' };
  }

  return { mode: 'lexical', slug: null, lexicalRaw: text };
}

/**
 * Map folded content terms → topic ids via term-topics weights.
 * Soft-empty when map missing / no matches.
 */
export function topicIdsFromContentTerms(
  contentTerms: string[],
  termTopics: TermTopicsLike | null | undefined,
  opts: { minWeight?: number; maxTopics?: number } = {},
): string[] {
  const minW = opts.minWeight ?? 0.01;
  const maxTopics = opts.maxTopics ?? 12;
  const terms = termTopics?.terms;
  if (!contentTerms?.length || !terms || typeof terms !== 'object') {
    return [];
  }

  const scoreById = new Map<string, number>();
  const keys = contentTerms.map((t) => foldTopicTerm(t)).filter(Boolean);
  if (keys.length >= 2) {
    keys.push(keys.join(' '));
  }
  for (const key of keys) {
    const entries = terms[key] || [];
    for (const e of entries) {
      if (!e?.topicId || !(e.w >= minW)) continue;
      scoreById.set(e.topicId, Math.max(scoreById.get(e.topicId) ?? 0, e.w));
    }
  }

  return [...scoreById.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxTopics)
    .map(([id]) => id);
}

export function unitKey(documentId: string, unitIndex: number): string {
  return `${documentId}:${unitIndex}`;
}

/** topicId → Set of "docId:unitIndex" from postings. */
export function membershipFromPostings(
  postings: TopicPostingsLike | null | undefined,
  topicIds: string[],
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!postings?.postings || !topicIds.length) return out;
  for (const tid of topicIds) {
    const list = postings.postings[tid] || [];
    const set = new Set<string>();
    for (const c of list) {
      if (c?.documentId != null && Number.isFinite(c.unitIndex)) {
        set.add(unitKey(c.documentId, c.unitIndex));
      }
    }
    if (set.size) out.set(tid, set);
  }
  return out;
}

/**
 * Soft boost lexical hits that appear in query topics' postings.
 * α default 0.25; conf default 1 when membership only.
 */
export function boostHitsWithTopics<T extends TopicBoostableHit>(
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

/** conf map from postings for boost (key = topicId|doc:ui and doc:ui). */
export function confMapFromPostings(
  postings: TopicPostingsLike | null | undefined,
  topicIds: string[],
): Map<string, number> {
  const out = new Map<string, number>();
  if (!postings?.postings) return out;
  for (const tid of topicIds) {
    for (const c of postings.postings[tid] || []) {
      if (!c?.documentId || !Number.isFinite(c.unitIndex)) continue;
      const uk = unitKey(c.documentId, c.unitIndex);
      const conf = Number.isFinite(c.conf) ? c.conf : 1;
      out.set(`${tid}|${uk}`, conf);
      const prev = out.get(uk) ?? 0;
      if (conf > prev) out.set(uk, conf);
    }
  }
  return out;
}

/**
 * Apply term→topic membership boost when pack has data; else identity.
 * Safe with empty postings / empty term-topics.
 */
export function applyTopicBoostIfAny<T extends TopicBoostableHit>(
  hits: T[],
  pack: TopicPackQueryLike | null | undefined,
  contentTerms: string[],
  alpha = 0.25,
): TopicBoostResult<T> {
  if (!hits.length || !pack || !contentTerms?.length) {
    return { hits, topicIds: [], boosted: false };
  }
  const hasTerms =
    pack.termTopics?.terms && Object.keys(pack.termTopics.terms).length > 0;
  const hasPostings =
    pack.postings?.postings && Object.keys(pack.postings.postings).length > 0;
  if (!hasTerms && !hasPostings) {
    return { hits, topicIds: [], boosted: false };
  }

  const topicIds = topicIdsFromContentTerms(contentTerms, pack.termTopics);
  if (!topicIds.length) {
    return { hits, topicIds: [], boosted: false };
  }

  const membership = membershipFromPostings(pack.postings, topicIds);
  if (!membership.size) {
    return { hits, topicIds, boosted: false };
  }

  const confByKey = confMapFromPostings(pack.postings, topicIds);
  const boostedHits = boostHitsWithTopics(
    hits,
    membership,
    topicIds,
    confByKey,
    alpha,
  );
  // Re-sort by score (boost may reorder)
  const sorted = [...boostedHits].sort(
    (a, b) =>
      b.score - a.score ||
      a.documentId.localeCompare(b.documentId) ||
      a.unitIndex - b.unitIndex,
  );
  return { hits: sorted, topicIds, boosted: true };
}

/** Resolve topic by slug, id, or `topic:{locale}:{slug}`. */
export function findTopicInPack(
  pack: TopicPackQueryLike | null | undefined,
  slugOrId: string,
): TopicRecordLike | null {
  if (!pack || !slugOrId) return null;
  const q = slugOrId.trim().toLowerCase();
  if (!q) return null;
  const locale = pack.manifest?.locale || '';
  return (
    pack.topics.find((t) => {
      if (t.slug.toLowerCase() === q) return true;
      if (t.id.toLowerCase() === q) return true;
      if (locale && t.id.toLowerCase() === `topic:${locale}:${q}`) return true;
      if (t.aliases?.some((a) => foldTopicTerm(a) === foldTopicTerm(q))) {
        return true;
      }
      return false;
    }) || null
  );
}

/**
 * Rank primarily by topic postings (score from conf).
 * Empty when pack/topic/postings missing — caller should soft-fall back to lexical.
 */
export function hitsFromTopicPostings(
  pack: TopicPackQueryLike | null | undefined,
  slugOrId: string,
  limit = 80,
): TopicBoostableHit[] {
  if (!pack || !slugOrId || limit <= 0) return [];
  const topic = findTopicInPack(pack, slugOrId);
  const topicId = topic?.id;
  if (!topicId) {
    // Allow raw id lookup even if not in catalog
    const rawId = slugOrId.trim();
    const list = pack.postings?.postings?.[rawId];
    if (!list?.length) return [];
    return citationsToHits(list, limit, [rawId]);
  }
  const list = pack.postings?.postings?.[topicId] || [];
  if (!list.length) return [];
  return citationsToHits(list, limit, [topic.slug || topicId]);
}

function citationsToHits(
  list: TopicCitationLike[],
  limit: number,
  highlight: string[],
): TopicBoostableHit[] {
  const sorted = [...list]
    .filter(
      (c) =>
        c &&
        c.documentId &&
        Number.isFinite(c.unitIndex) &&
        c.unitIndex >= 0,
    )
    .sort(
      (a, b) =>
        (b.conf ?? 0) - (a.conf ?? 0) ||
        a.documentId.localeCompare(b.documentId) ||
        a.unitIndex - b.unitIndex,
    )
    .slice(0, limit);

  return sorted.map((c) => ({
    documentId: c.documentId,
    unitIndex: c.unitIndex,
    score: Math.round((Number.isFinite(c.conf) ? c.conf : 0) * 1000) / 1000,
    consecutivo: c.consecutivo,
    matchedTerms: highlight,
    highlightTerms: highlight,
  }));
}

/** True when pack has usable term-topics or postings for boost/topic mode. */
export function packHasTopicSignals(
  pack: TopicPackQueryLike | null | undefined,
): boolean {
  if (!pack) return false;
  const terms = pack.termTopics?.terms;
  if (terms && Object.keys(terms).length > 0) return true;
  const post = pack.postings?.postings;
  if (post && Object.keys(post).length > 0) return true;
  return false;
}
