/**
 * Pure multi-label topic assignment for hub units (no I/O, no LLM).
 * Used by build_topic_postings.ts and unit tests.
 */

export const HUB_KINDS = [
  'catechism',
  'magisterium',
  'council',
  'canon-law',
] as const;

export type HubKind = (typeof HUB_KINDS)[number];

export const MAX_TOPICS_PER_UNIT = 3;
export const MAX_POSTINGS_PER_TOPIC = 200;
export const PRIMARY_TERM_WEIGHT = 1;
export const ALIAS_TERM_WEIGHT = 0.7;
/** Minimum raw score to assign a topic (one primary term hit). */
export const SCORE_THRESHOLD = 1.0;

export interface SeedTopicInput {
  slug: string;
  label: string;
  terms?: string[];
  aliases?: string[];
  /** Canonical parent topic id or slug (seed may use `parent`). */
  parentId?: string | null;
  parent?: string | null;
  relatedIds?: string[];
  /** Seed shorthand: list of related slugs. */
  related?: string[];
}

export interface AssignTopic {
  id: string;
  slug: string;
  label: string;
  /** Primary terms (weight 1). Folded forms used for matching. */
  primaryTerms: string[];
  /** Alias / secondary terms (weight 0.7). */
  aliasTerms: string[];
  kind?: 'seed' | 'discovered';
  parentId?: string | null;
  relatedIds?: string[];
}

export interface UnitInput {
  documentId: string;
  unitIndex: number;
  contenido: string;
  consecutivo?: string;
  kind?: string;
}

export interface TopicAssignment {
  topicId: string;
  score: number;
  conf: number;
  source: 'seed';
}

export interface TopicCitation {
  documentId: string;
  unitIndex: number;
  conf: number;
  consecutivo?: string;
  /** Transient: used when capping; not written to pack. */
  kind?: string;
}

/** Minimal ES fixture when seed file and pack catalog are missing (~15 topics). */
export const MINIMAL_SEED_FIXTURE_ES: SeedTopicInput[] = [
  {
    slug: 'gracia',
    label: 'Gracia',
    terms: ['gracia', 'gracias', 'graciosamente', 'santificante'],
    aliases: ['don de dios', 'favor divino'],
  },
  {
    slug: 'trinidad',
    label: 'Santísima Trinidad',
    terms: ['trinidad', 'trinitaria', 'trinitario'],
    aliases: ['padre hijo espiritu', 'tres personas'],
  },
  {
    slug: 'eucaristia',
    label: 'Eucaristía',
    terms: ['eucaristia', 'eucaristico', 'eucaristica', 'consagracion'],
    aliases: ['sagrada comunion', 'cuerpo de cristo', 'santissimo sacramento'],
  },
  {
    slug: 'matrimonio',
    label: 'Matrimonio',
    terms: ['matrimonio', 'matrimonial', 'esposos', 'conyugal'],
    aliases: ['sacramento del matrimonio', 'union conyugal'],
  },
  {
    slug: 'bautismo',
    label: 'Bautismo',
    terms: ['bautismo', 'bautismal', 'bautizar', 'bautizado'],
    aliases: ['agua del bautismo', 'regeneracion'],
  },
  {
    slug: 'fe',
    label: 'Fe',
    terms: ['fe', 'creer', 'creyente', 'fieles'],
    aliases: ['acto de fe', 'virtud teologal'],
  },
  {
    slug: 'iglesia',
    label: 'Iglesia',
    terms: ['iglesia', 'eclesial', 'eclesiastica'],
    aliases: ['pueblo de dios', 'cuerpo mistico'],
  },
  {
    slug: 'pecado',
    label: 'Pecado',
    terms: ['pecado', 'pecados', 'pecador', 'pecaminoso'],
    aliases: ['transgresion', 'culpa moral'],
  },
  {
    slug: 'caridad',
    label: 'Caridad',
    terms: ['caridad', 'caritativo', 'amar', 'amor'],
    aliases: ['amor al projimo', 'dilectio'],
  },
  {
    slug: 'misericordia',
    label: 'Misericordia',
    terms: ['misericordia', 'misericordioso', 'compasion'],
    aliases: ['corazon misericordioso'],
  },
  {
    slug: 'espiritu-santo',
    label: 'Espíritu Santo',
    terms: ['espiritu santo', 'paraclito', 'consolador'],
    aliases: ['don del espiritu', 'pentecostes'],
  },
  {
    slug: 'cristo',
    label: 'Cristo',
    terms: ['cristo', 'jesucristo', 'mesias'],
    aliases: ['hijo de dios', 'señor jesus'],
  },
  {
    slug: 'salvacion',
    label: 'Salvación',
    terms: ['salvacion', 'salvar', 'salvador', 'redencion', 'redentor'],
    aliases: ['obra salvifica'],
  },
  {
    slug: 'oracion',
    label: 'Oración',
    terms: ['oracion', 'orar', 'rezo', 'rezar', 'peticion'],
    aliases: ['pater noster', 'padrenuestro'],
  },
  {
    slug: 'liturgia',
    label: 'Liturgia',
    terms: ['liturgia', 'liturgica', 'liturgico', 'celebracion'],
    aliases: ['sagrada liturgia', 'rito'],
  },
];

/** Strip diacritics (keep ñ), lowercase, non-alnum → space, collapse. */
export function foldText(raw: string): string {
  if (!raw) return '';
  const stripped = String(raw)
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize()
    .toLowerCase();
  return stripped
    .replace(/[^a-z0-9ñü\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeFolded(folded: string): string[] {
  if (!folded) return [];
  return folded.split(/\s+/).filter((t) => t.length > 0);
}

export function topicIdFor(locale: string, slug: string): string {
  return `topic:${locale}:${slug}`;
}

export function isHubKind(kind: string | undefined | null): kind is HubKind {
  return (
    kind === 'catechism' ||
    kind === 'magisterium' ||
    kind === 'council' ||
    kind === 'canon-law'
  );
}

export function isHubDocument(
  meta: { kind?: string; locale?: string; id: string },
  locale: string,
): boolean {
  if (!isHubKind(meta.kind)) return false;
  const loc = (meta.locale || '').toLowerCase();
  if (loc === locale) return true;
  return meta.id.toLowerCase().endsWith(`-${locale}`);
}

/** Normalize seed rows into AssignTopic (dedupe terms, fold phrases). */
export function topicsFromSeed(
  seeds: SeedTopicInput[],
  locale: string,
): AssignTopic[] {
  const out: AssignTopic[] = [];
  const seen = new Set<string>();
  for (const s of seeds) {
    const slug = String(s.slug || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const id = topicIdFor(locale, slug);
    const primaryRaw = Array.isArray(s.terms) ? s.terms : [s.label, slug];
    const aliasRaw = Array.isArray(s.aliases) ? s.aliases : [];
    const primaryTerms = uniqueNonEmpty(
      primaryRaw
        .map((t) => foldText(String(t)))
        .filter((t) => t && !isNoiseTerm(t)),
    );
    const aliasSet = new Set(primaryTerms);
    const aliasTerms = uniqueNonEmpty(
      aliasRaw
        .map((t) => foldText(String(t)))
        .filter((t) => t && !aliasSet.has(t) && !isNoiseTerm(t)),
    );
    if (!primaryTerms.length && s.label) {
      primaryTerms.push(foldText(s.label));
    }
    if (!primaryTerms.length) {
      primaryTerms.push(foldText(slug.replace(/-/g, ' ')));
    }
    const parentSlug = s.parentId ?? s.parent ?? null;
    const parentId =
      parentSlug == null || parentSlug === ''
        ? null
        : String(parentSlug).startsWith('topic:')
          ? String(parentSlug)
          : topicIdFor(locale, String(parentSlug));
    const relatedRaw = s.relatedIds?.length
      ? s.relatedIds
      : Array.isArray(s.related)
        ? s.related
        : undefined;
    const relatedIds = relatedRaw?.map((r) =>
      String(r).startsWith('topic:')
        ? String(r)
        : topicIdFor(locale, String(r)),
    );
    out.push({
      id,
      slug,
      label: s.label || slug,
      primaryTerms,
      aliasTerms,
      kind: 'seed',
      parentId,
      relatedIds,
    });
  }
  return out;
}

/**
 * Build AssignTopic list from pack topics.json + inverted term-topics.
 * term weight ≥ 0.95 → primary; else alias.
 */
export function topicsFromPack(
  locale: string,
  topics: Array<{
    id?: string;
    slug: string;
    label: string;
    aliases?: string[];
    kind?: 'seed' | 'discovered';
    parentId?: string | null;
    relatedIds?: string[];
  }>,
  termTopics?: Record<string, Array<{ topicId: string; w: number }>>,
): AssignTopic[] {
  const byId = new Map<string, AssignTopic>();
  for (const t of topics) {
    const slug = String(t.slug || '').trim();
    if (!slug) continue;
    const id = t.id || topicIdFor(locale, slug);
    const aliasTerms = uniqueNonEmpty(
      (t.aliases || []).map((a) => foldText(String(a))),
    );
    byId.set(id, {
      id,
      slug,
      label: t.label || slug,
      primaryTerms: uniqueNonEmpty([
        foldText(slug.replace(/-/g, ' ')),
        foldText(t.label || ''),
      ]),
      aliasTerms,
      kind: t.kind || 'seed',
      parentId: t.parentId ?? null,
      relatedIds: t.relatedIds,
    });
  }
  if (termTopics) {
    for (const [term, list] of Object.entries(termTopics)) {
      const folded = foldText(term);
      if (!folded || isNoiseTerm(folded)) continue;
      for (const entry of list || []) {
        const at = byId.get(entry.topicId);
        if (!at) continue;
        const w = Number(entry.w);
        if (w >= 0.95) {
          if (!at.primaryTerms.includes(folded)) at.primaryTerms.push(folded);
        } else if (
          !at.primaryTerms.includes(folded) &&
          !at.aliasTerms.includes(folded)
        ) {
          at.aliasTerms.push(folded);
        }
      }
    }
    // Drop noise that may have been injected via slug/label path
    for (const at of byId.values()) {
      at.primaryTerms = at.primaryTerms.filter((t) => !isNoiseTerm(t));
      at.aliasTerms = at.aliasTerms.filter((t) => !isNoiseTerm(t));
    }
  }
  return [...byId.values()];
}

function uniqueNonEmpty(arr: string[]): string[] {
  const s = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const v = (x || '').trim();
    if (!v || s.has(v)) continue;
    s.add(v);
    out.push(v);
  }
  return out;
}

/** Count non-overlapping / sliding phrase hits of term tokens in unit tokens. */
export function countPhraseHits(
  unitTokens: string[],
  phraseFolded: string,
): number {
  const phrase = tokenizeFolded(phraseFolded);
  if (!phrase.length) return 0;
  if (phrase.length === 1) {
    const p = phrase[0];
    let n = 0;
    for (const t of unitTokens) {
      if (t === p) n++;
    }
    return n;
  }
  let n = 0;
  const plen = phrase.length;
  for (let i = 0; i <= unitTokens.length - plen; i++) {
    let ok = true;
    for (let j = 0; j < plen; j++) {
      if (unitTokens[i + j] !== phrase[j]) {
        ok = false;
        break;
      }
    }
    if (ok) n++;
  }
  return n;
}

export function scoreTopicOnTokens(
  unitTokens: string[],
  topic: AssignTopic,
): { score: number; primaryHits: number } {
  let score = 0;
  let primaryHits = 0;
  for (const term of topic.primaryTerms) {
    const hits = countPhraseHits(unitTokens, term);
    if (hits > 0) {
      score += hits * PRIMARY_TERM_WEIGHT;
      primaryHits += hits;
    }
  }
  for (const term of topic.aliasTerms) {
    const hits = countPhraseHits(unitTokens, term);
    if (hits > 0) score += hits * ALIAS_TERM_WEIGHT;
  }
  return { score, primaryHits };
}

/** conf in (0,1] from raw score. */
export function confFromScore(score: number): number {
  if (score <= 0) return 0;
  // 1 primary → ~0.5; 2 → ~0.67; 3+ approaches 1
  return Math.min(1, score / (1 + score));
}

/**
 * Stopword-ish tokens that must not become solo matching terms when
 * reconstructing AssignTopic from term-topics / aliases.
 */
const NOISE_SINGLE_TOKENS = new Set([
  'a',
  'al',
  'de',
  'del',
  'el',
  'la',
  'las',
  'los',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'u',
  'en',
  'con',
  'por',
  'para',
  'sin',
  'sobre',
  'entre',
  'que',
  'se',
  'su',
  'sus',
  'lo',
  'le',
  'les',
  'es',
  'son',
  'como',
  'mas',
  'más',
  'no',
  'ni',
  'e',
  'i',
]);

export function isNoiseTerm(folded: string): boolean {
  const t = folded.trim();
  if (!t) return true;
  if (t.includes(' ')) return false; // multi-word phrases ok
  // Keep short content terms like "fe"; only drop closed-class noise.
  return NOISE_SINGLE_TOKENS.has(t);
}

/**
 * Score all topics against unit text; return top-K above threshold.
 * Prefer topics with at least one primary term hit (score ≥ SCORE_THRESHOLD).
 */
export function assignTopicsToUnit(
  contenido: string,
  topics: AssignTopic[],
  opts?: {
    maxTopics?: number;
    threshold?: number;
  },
): TopicAssignment[] {
  const maxTopics = opts?.maxTopics ?? MAX_TOPICS_PER_UNIT;
  const threshold = opts?.threshold ?? SCORE_THRESHOLD;
  const tokens = tokenizeFolded(foldText(contenido));
  if (!tokens.length || !topics.length) return [];

  const scored: TopicAssignment[] = [];
  for (const topic of topics) {
    const { score, primaryHits } = scoreTopicOnTokens(tokens, topic);
    if (score < threshold && primaryHits < 1) continue;
    if (score < threshold) continue;
    scored.push({
      topicId: topic.id,
      score,
      conf: confFromScore(score),
      source: 'seed',
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.conf - a.conf ||
      a.topicId.localeCompare(b.topicId),
  );
  return scored.slice(0, maxTopics);
}

/** Kind rank for posting priority (lower = better). */
export function kindRank(kind: string | undefined, documentId: string): number {
  if (documentId === 'cic-es') return 0;
  switch (kind) {
    case 'catechism':
      return 1;
    case 'magisterium':
      return 2;
    case 'council':
      return 3;
    case 'canon-law':
      return 4;
    default:
      return 9;
  }
}

/**
 * Cap postings per topic to M: conf desc, prefer cic-es/catechism, then
 * magisterium, then documentId, unitIndex.
 */
export function capPostings(
  list: TopicCitation[],
  max = MAX_POSTINGS_PER_TOPIC,
): TopicCitation[] {
  const sorted = [...list].sort((a, b) => {
    if (b.conf !== a.conf) return b.conf - a.conf;
    const ka = kindRank(a.kind, a.documentId);
    const kb = kindRank(b.kind, b.documentId);
    if (ka !== kb) return ka - kb;
    const d = a.documentId.localeCompare(b.documentId);
    if (d !== 0) return d;
    return a.unitIndex - b.unitIndex;
  });
  return sorted.slice(0, max);
}

/** Strip transient fields for pack JSON. */
export function toPackCitation(c: TopicCitation): {
  documentId: string;
  unitIndex: number;
  conf: number;
  consecutivo?: string;
} {
  const out: {
    documentId: string;
    unitIndex: number;
    conf: number;
    consecutivo?: string;
  } = {
    documentId: c.documentId,
    unitIndex: c.unitIndex,
    conf: roundConf(c.conf),
  };
  if (c.consecutivo != null && c.consecutivo !== '') {
    out.consecutivo = String(c.consecutivo);
  }
  return out;
}

function roundConf(c: number): number {
  return Math.round(Math.min(1, Math.max(0, c)) * 1000) / 1000;
}

/** Build term-topics map from AssignTopic list. */
export function buildTermTopicsMap(
  topics: AssignTopic[],
): Record<string, Array<{ topicId: string; w: number }>> {
  const terms: Record<string, Array<{ topicId: string; w: number }>> = {};
  const add = (term: string, topicId: string, w: number) => {
    const key = foldText(term);
    if (!key) return;
    if (!terms[key]) terms[key] = [];
    if (terms[key].some((e) => e.topicId === topicId)) return;
    terms[key].push({ topicId, w });
  };
  for (const t of topics) {
    for (const p of t.primaryTerms) add(p, t.id, 1);
    for (const a of t.aliasTerms) add(a, t.id, ALIAS_TERM_WEIGHT);
  }
  return terms;
}

/** Pack topics.json records (without terms). */
export function toTopicRecords(
  topics: AssignTopic[],
  stats?: Map<string, { unitCount: number; documentCount: number }>,
): Array<{
  id: string;
  slug: string;
  label: string;
  aliases?: string[];
  parentId?: string | null;
  relatedIds?: string[];
  kind: 'seed' | 'discovered';
  unitCount?: number;
  documentCount?: number;
}> {
  return topics.map((t) => {
    const st = stats?.get(t.id);
    const rec: {
      id: string;
      slug: string;
      label: string;
      aliases?: string[];
      parentId?: string | null;
      relatedIds?: string[];
      kind: 'seed' | 'discovered';
      unitCount?: number;
      documentCount?: number;
    } = {
      id: t.id,
      slug: t.slug,
      label: t.label,
      kind: t.kind || 'seed',
    };
    if (t.aliasTerms.length) {
      // store original-ish aliases from folded forms
      rec.aliases = t.aliasTerms;
    }
    if (t.parentId !== undefined) rec.parentId = t.parentId;
    if (t.relatedIds?.length) rec.relatedIds = t.relatedIds;
    if (st) {
      rec.unitCount = st.unitCount;
      rec.documentCount = st.documentCount;
    }
    return rec;
  });
}
