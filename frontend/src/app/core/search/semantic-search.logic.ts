/**
 * Offline phrase / intention search over the packed inverted index.
 *
 * Pure functions (no Angular, no network, no LLM). Multi-word queries like
 * "el amor de Dios" are tokenized, stopwords dropped, and units are ranked by
 * lexical relatedness (shared content terms + optional phrase bonus + bounded
 * synonym expansion). Stable citations use documentId + unitIndex.
 *
 * Does not rewrite pack artifacts — query-time ranking on existing
 * content.json / index.json.
 */

/** Spanish function words that rarely carry theological intent alone. */
export const SPANISH_STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'al',
  'algo',
  'algun',
  'alguna',
  'algunas',
  'algunos',
  'ante',
  'antes',
  'aquel',
  'aquella',
  'aquellas',
  'aquellos',
  'aqui',
  'asi',
  'aunque',
  'bajo',
  'bien',
  'cada',
  'como',
  'con',
  'contra',
  'cual',
  'cuales',
  'cuando',
  'de',
  'del',
  'desde',
  'donde',
  'dos',
  'el',
  'ella',
  'ellas',
  'ellos',
  'en',
  'entre',
  'era',
  'erais',
  'eran',
  'eras',
  'eres',
  'es',
  'esa',
  'esas',
  'ese',
  'eso',
  'esos',
  'esta',
  'estaba',
  'estado',
  'estais',
  'estamos',
  'estan',
  'estar',
  'estas',
  'este',
  'esto',
  'estos',
  'estoy',
  'etc',
  'fue',
  'fueron',
  'fui',
  'ha',
  'habeis',
  'haber',
  'habia',
  'han',
  'has',
  'hasta',
  'hay',
  'he',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'mas',
  'me',
  'mi',
  'mia',
  'mias',
  'mio',
  'mios',
  'mis',
  'muy',
  'ni',
  'no',
  'nos',
  'nosotras',
  'nosotros',
  'nuestra',
  'nuestras',
  'nuestro',
  'nuestros',
  'o',
  'os',
  'otra',
  'otras',
  'otro',
  'otros',
  'para',
  'pero',
  'poco',
  'por',
  'porque',
  'que',
  'quien',
  'quienes',
  'se',
  'sea',
  'segun',
  'ser',
  'si',
  'sido',
  'sin',
  'sino',
  'so',
  'sobre',
  'sois',
  'somos',
  'son',
  'soy',
  'su',
  'sus',
  'suya',
  'suyas',
  'suyo',
  'suyos',
  'tal',
  'tambien',
  'te',
  'tiene',
  'tienen',
  'toda',
  'todas',
  'todo',
  'todos',
  'tu',
  'tus',
  'un',
  'una',
  'uno',
  'unos',
  'usted',
  'ustedes',
  'va',
  'vais',
  'vamos',
  'van',
  'vosotros',
  'y',
  'ya',
  'yo',
]);

/**
 * Bounded theological / lexical relatedness (query expansion).
 * Keys and values are already folded (no diacritics, lowercase).
 * Expansion terms score lower than direct matches.
 */
export const RELATED_TERMS: Readonly<Record<string, readonly string[]>> = {
  amor: ['caridad', 'amar', 'amado', 'amada', 'amores'],
  amar: ['amor', 'caridad', 'amado'],
  caridad: ['amor', 'amar', 'caritativo'],
  dios: ['señor', 'padre', 'creador'],
  señor: ['dios'],
  senor: ['dios'],
  cristo: ['jesucristo', 'jesus', 'mesias'],
  jesus: ['jesucristo', 'cristo'],
  jesucristo: ['jesus', 'cristo'],
  espiritu: ['paraclito', 'consolador'],
  fe: ['creer', 'creencia', 'fiel'],
  gracia: ['gracia', 'don'],
  pecados: ['pecado', 'culpa'],
  pecado: ['pecados', 'culpa'],
  iglesia: ['iglesia', 'ecclesia'],
  salvacion: ['redencion', 'salvar'],
  misericordia: ['compasion', 'piedad'],
};

export interface SearchUnit {
  /** Array index in the document pack (stable unitIndex). */
  unitIndex?: number;
  index_array?: number;
  consecutivo?: string;
  contenido?: string;
}

export interface CorpusIndexLike {
  indice: { [term: string]: number[] | undefined };
  indice_por_punto?: { [unitIndex: number]: number | null | undefined };
}

export interface ParsedSearch {
  /** Non-empty after trim; false for blank input. */
  empty: boolean;
  /** Raw phrase clauses (comma-separated text terms, for highlight). */
  phrases: string[];
  /**
   * Folded content tokens used for ranking (stopwords removed, synonyms
   * not yet expanded).
   */
  contentTerms: string[];
  /** Point / consecutive numbers from `.123` / `.200-205` clauses. */
  points: number[];
}

export interface RankedUnitHit {
  documentId: string;
  unitIndex: number;
  consecutivo?: string;
  score: number;
  /** Content terms from the query that matched this unit (direct or expanded). */
  matchedTerms: string[];
  /** Terms to highlight in snippets (content + expansions that hit). */
  highlightTerms: string[];
}

export interface SearchDocumentInput {
  documentId: string;
  index: CorpusIndexLike;
  units: SearchUnit[];
}

export interface RankOptions {
  /** Max hits per document (default unlimited). */
  limit?: number;
  /**
   * When true (default), multi-term intention queries require a minimum
   * number of content-term hits so single common words do not flood results.
   */
  requireMultiTermOverlap?: boolean;
}

/** Same diacritic strip as index build / UtilidadesService (keeps ñ). */
export function stripDiacritics(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize();
}

/** Match pack index key cleaning (subset of build_index). */
export function cleanForIndex(texto: string): string {
  return texto
    .replace(/[,"\.«»“”:;!¡¿?—']/gi, '')
    .replace(/\( \[\+\[\d*\]\+\] \)/gi, '')
    .replace(/\s/gi, '###')
    .replace(/#{3,21}/gi, ' ')
    .replace(/[\[\]”']/gi, '')
    .replace(/[-\(\)\*\/`‘–…]/gi, '')
    .trim();
}

export function foldToken(raw: string): string {
  return cleanForIndex(stripDiacritics(raw)).toLowerCase().trim();
}

/** Split folded text into non-empty tokens. */
export function tokenizeFolded(folded: string): string[] {
  return folded
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Pure digits (unit numbers printed at the start of packed bodies). */
export function isPureNumericToken(tok: string): boolean {
  return /^\d+$/.test(tok);
}

/**
 * Drop a leading consecutivo printed in unit body ("356 De todas…").
 * Does not touch mid-sentence numbers.
 */
export function stripLeadingConsecutivo(text: string): string {
  return String(text || '')
    .replace(/^\s*\d{1,6}\s+/, '')
    .trim();
}

/**
 * Content-bearing tokens: fold, split, drop stopwords, pure numbers, and
 * very short tokens. Leading unit numbers must not enter relatedness seeds.
 */
export function contentTermsFromText(text: string): string[] {
  const folded = foldToken(stripLeadingConsecutivo(text));
  if (!folded) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokenizeFolded(folded)) {
    if (tok.length < 2) continue;
    if (isPureNumericToken(tok)) continue;
    if (SPANISH_STOPWORDS.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

/** Lexicon surfaces used by RELATED_TERMS (keys + expansions). */
function relatedLexiconSet(): Set<string> {
  const set = new Set<string>();
  for (const [k, vals] of Object.entries(RELATED_TERMS)) {
    set.add(k);
    for (const v of vals) set.add(v);
  }
  return set;
}

/**
 * Cap content terms for related-unit queries: prefer theological / lexicon
 * anchors in appearance order, then remaining early prose terms.
 * Avoids length-only picks (conocimiento, criaturas) drowning amor/dios.
 */
export function pickRelatedContentTerms(
  rawTerms: string[],
  max = 4,
): string[] {
  const filtered = rawTerms.filter(
    (t) => t && !isPureNumericToken(t) && t.length >= 2,
  );
  if (!filtered.length) return [];
  const lexicon = relatedLexiconSet();
  const picked: string[] = [];
  for (const t of filtered) {
    if (picked.length >= max) break;
    if (lexicon.has(t) && !picked.includes(t)) picked.push(t);
  }
  for (const t of filtered) {
    if (picked.length >= max) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}

/**
 * Expand content terms with bounded related terms (deduped).
 * Returns map term → weight (1 = direct, <1 = related).
 */
export function expandTermsWithWeights(
  contentTerms: string[],
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const t of contentTerms) {
    weights.set(t, Math.max(weights.get(t) ?? 0, 1));
    const rel = RELATED_TERMS[t];
    if (!rel) continue;
    for (const r of rel) {
      if (SPANISH_STOPWORDS.has(r) || r.length < 2) continue;
      const prev = weights.get(r) ?? 0;
      // Related expansion never outranks a direct match.
      weights.set(r, Math.max(prev, 0.55));
    }
  }
  return weights;
}

/**
 * Parse user search string: comma-separated phrases + `.punto` / `.a-b` ranges.
 * Multi-word phrases stay one clause; contentTerms is the union of tokens.
 */
export function parseSearchInput(raw: string | null | undefined): ParsedSearch {
  if (raw == null || String(raw).trim() === '') {
    return { empty: true, phrases: [], contentTerms: [], points: [] };
  }

  const clauses = String(raw)
    .split(',')
    .map((v) => v.trim())
    .filter((x) => x !== '');

  const phrases: string[] = [];
  const pointSet = new Set<number>();

  for (const clause of clauses) {
    if (clause[0] === '.') {
      for (const n of expandPointClause(clause.slice(1))) {
        pointSet.add(n);
      }
      continue;
    }
    phrases.push(clause);
  }

  const contentSeen = new Set<string>();
  const contentTerms: string[] = [];
  for (const phrase of phrases) {
    for (const t of contentTermsFromText(phrase)) {
      if (contentSeen.has(t)) continue;
      contentSeen.add(t);
      contentTerms.push(t);
    }
  }

  const points = [...pointSet].sort((a, b) => a - b);
  const empty = phrases.length === 0 && points.length === 0;
  return { empty, phrases, contentTerms, points };
}

/** Expand `.123` or `200-205` into consecutive point numbers (inclusive). */
export function expandPointClause(body: string): number[] {
  const parts = body.split('-').map((p) => p.trim());
  if (parts.length > 2) return [];
  const nums = parts
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return [];
  if (nums.length === 1) return [nums[0]!];
  const lo = Math.min(nums[0]!, nums[1]!);
  const hi = Math.max(nums[0]!, nums[1]!);
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) out.push(n);
  return out;
}

/**
 * Resolve consecutivo numbers to unit array indices via indice_por_punto.
 */
export function resolvePointsToUnitIndices(
  points: number[],
  indicePorPunto: CorpusIndexLike['indice_por_punto'] | undefined,
): number[] {
  if (!points.length || !indicePorPunto) return [];
  const hits: number[] = [];
  const seen = new Set<number>();
  for (const p of points) {
    for (const key of Object.keys(indicePorPunto)) {
      const unitIndex = parseInt(key, 10);
      if (!Number.isFinite(unitIndex)) continue;
      if (indicePorPunto[unitIndex as keyof typeof indicePorPunto] === p) {
        if (!seen.has(unitIndex)) {
          seen.add(unitIndex);
          hits.push(unitIndex);
        }
        break;
      }
    }
  }
  return hits;
}

function phrasePresentInUnit(phrase: string, unitTextFolded: string): boolean {
  const content = contentTermsFromText(phrase);
  if (content.length < 2) return false;
  // Ordered window: all content terms appear (order soft — presence of sequence
  // of first…last with gaps allowed is expensive; check contiguous join first).
  const joined = content.join(' ');
  if (unitTextFolded.includes(joined)) return true;
  // Soft ordered: first term index < second < …
  let from = 0;
  for (const t of content) {
    const i = unitTextFolded.indexOf(t, from);
    if (i < 0) return false;
    from = i + t.length;
  }
  return true;
}

/**
 * Map each expanded surface form back to the direct content term(s) it covers.
 */
function reverseExpansion(
  contentTerms: string[],
): Map<string, string[]> {
  const rev = new Map<string, string[]>();
  const add = (surface: string, direct: string) => {
    const list = rev.get(surface) ?? [];
    if (!list.includes(direct)) list.push(direct);
    rev.set(surface, list);
  };
  for (const t of contentTerms) {
    add(t, t);
    const rel = RELATED_TERMS[t];
    if (!rel) continue;
    for (const r of rel) add(r, t);
  }
  return rev;
}

/**
 * Rank units in one document for a parsed query.
 * Combines inverted-index postings with relatedness scoring.
 */
export function rankUnitsForDocument(
  doc: SearchDocumentInput,
  parsed: ParsedSearch,
  options: RankOptions = {},
): RankedUnitHit[] {
  if (parsed.empty) return [];

  const requireOverlap = options.requireMultiTermOverlap !== false;
  const termWeights = expandTermsWithWeights(parsed.contentTerms);
  const surfaceToDirect = reverseExpansion(parsed.contentTerms);

  /** unitIndex → score + which direct content terms are covered */
  const acc = new Map<
    number,
    { score: number; covered: Set<string>; highlight: Set<string> }
  >();

  const ensure = (ui: number) => {
    let row = acc.get(ui);
    if (!row) {
      row = { score: 0, covered: new Set(), highlight: new Set() };
      acc.set(ui, row);
    }
    return row;
  };

  // Exact whole-phrase inverted keys (legacy single-token path).
  for (const phrase of parsed.phrases) {
    const key = foldToken(phrase);
    if (!key || key.includes(' ')) continue;
    const postings = doc.index.indice[key];
    if (!postings) continue;
    for (const ui of postings) {
      const row = ensure(ui);
      row.score += 1.2;
      row.covered.add(key);
      row.highlight.add(key);
    }
  }

  // Content + expanded terms via inverted index.
  for (const [term, weight] of termWeights) {
    const postings = doc.index.indice[term];
    if (!postings || !postings.length) continue;
    // IDF-ish: rarer terms weigh more.
    const idf = 1 / Math.log2(2 + postings.length);
    const directs = surfaceToDirect.get(term) ?? [];
    for (const ui of postings) {
      const row = ensure(ui);
      row.score += weight * (0.85 + idf);
      for (const d of directs) row.covered.add(d);
      row.highlight.add(term);
    }
  }

  // Point lookups (consecutivo) — high confidence, fixed score boost.
  const pointUnits = resolvePointsToUnitIndices(
    parsed.points,
    doc.index.indice_por_punto,
  );
  const pointSet = new Set(pointUnits);
  for (const ui of pointUnits) {
    ensure(ui).score += 5;
  }

  const contentCount = parsed.contentTerms.length;
  // Single multi-word phrase ("el amor de Dios") → intention mode: require
  // overlapping content slots so a lone common word does not flood results.
  // Comma-separated tokens ("amor, dios") keep legacy OR: any term may hit.
  const intentionMode =
    requireOverlap &&
    parsed.phrases.length === 1 &&
    contentTermsFromText(parsed.phrases[0] ?? '').length >= 2;
  const minMatched = intentionMode
    ? Math.max(2, Math.ceil(contentCount * 0.5))
    : contentCount >= 1
      ? 1
      : 0;

  // Phrase / intention bonus when unit body is available.
  const phraseBonusNeeded = parsed.phrases.some(
    (p) => contentTermsFromText(p).length >= 2,
  );
  if (phraseBonusNeeded && doc.units?.length) {
    for (const [ui, row] of acc) {
      const unit = doc.units[ui];
      if (!unit?.contenido) continue;
      const folded = foldToken(unit.contenido);
      for (const phrase of parsed.phrases) {
        if (phrasePresentInUnit(phrase, folded)) {
          row.score += 2.5;
          break;
        }
      }
      if (contentCount > 0) {
        row.score += (row.covered.size / contentCount) * 1.5;
      }
    }
  } else if (contentCount > 0) {
    for (const row of acc.values()) {
      row.score += (row.covered.size / contentCount) * 1.5;
    }
  }

  let hits: RankedUnitHit[] = [];
  for (const [ui, row] of acc) {
    const fromPoint = pointSet.has(ui);
    if (!fromPoint) {
      if (contentCount === 0) continue;
      if (row.covered.size < minMatched) continue;
    }
    const unit = doc.units?.[ui];
    hits.push({
      documentId: doc.documentId,
      unitIndex: ui,
      consecutivo: unit?.consecutivo,
      score: Math.round(row.score * 1000) / 1000,
      matchedTerms: [...row.covered].sort(),
      highlightTerms: [...row.highlight].sort(),
    });
  }

  // Deterministic sort: score desc, unitIndex asc.
  hits.sort((a, b) => b.score - a.score || a.unitIndex - b.unitIndex);

  if (options.limit != null && options.limit >= 0) {
    hits = hits.slice(0, options.limit);
  }
  return hits;
}

/**
 * Search many documents; flat ranked list (global sort).
 */
export function rankUnitsAcrossDocuments(
  docs: SearchDocumentInput[],
  parsed: ParsedSearch,
  options: RankOptions = {},
): RankedUnitHit[] {
  if (parsed.empty) return [];
  const all: RankedUnitHit[] = [];
  for (const doc of docs) {
    // Per-doc limit omitted so global sort is fair; apply limit after merge.
    const { limit: _l, ...rest } = options;
    all.push(...rankUnitsForDocument(doc, parsed, rest));
  }
  all.sort(
    (a, b) =>
      b.score - a.score ||
      a.documentId.localeCompare(b.documentId) ||
      a.unitIndex - b.unitIndex,
  );
  if (options.limit != null && options.limit >= 0) {
    return all.slice(0, options.limit);
  }
  return all;
}

/**
 * Related units for themes/notes: treat source text as an intention query
 * and return other units (optionally excluding the source citation).
 * Caps content terms so long units still find lexical neighbors.
 */
export function findRelatedUnits(
  sourceText: string,
  docs: SearchDocumentInput[],
  opts: {
    exclude?: { documentId: string; unitIndex: number };
    limit?: number;
  } = {},
): RankedUnitHit[] {
  const rawTerms = contentTermsFromText(sourceText);
  if (!rawTerms.length) return [];
  const contentTerms = pickRelatedContentTerms(rawTerms, 4);
  if (!contentTerms.length) return [];
  const seedPhrase = contentTerms.join(' ');
  const parsed: ParsedSearch = {
    empty: false,
    phrases: [seedPhrase],
    contentTerms,
    points: [],
  };
  const hits = rankUnitsAcrossDocuments(docs, parsed, {
    limit: undefined,
    requireMultiTermOverlap: contentTerms.length >= 2,
  });
  const filtered = opts.exclude
    ? hits.filter(
        (h) =>
          !(
            h.documentId === opts.exclude!.documentId &&
            h.unitIndex === opts.exclude!.unitIndex
          ),
      )
    : hits;
  const limit = opts.limit ?? 20;
  return filtered.slice(0, limit);
}

/**
 * Convenience: parse + rank in one call (primary offline entry for UI/tests).
 */
export function searchCorpus(
  rawQuery: string | null | undefined,
  docs: SearchDocumentInput[],
  options: RankOptions = {},
): RankedUnitHit[] {
  const parsed = parseSearchInput(rawQuery);
  return rankUnitsAcrossDocuments(docs, parsed, options);
}

// ── Product-facing related citations (themes / notes) ───────────────────

export interface RelatedCitationRow {
  documentId: string;
  unitIndex: number;
  consecutivo?: string;
  score: number;
  /** Compact chrome label, e.g. "cic-es · Nº 27". */
  title: string;
  /** Short plain snippet for list rows. */
  snippet: string;
  matchedTerms: string[];
}

export interface ThemeStepSeed {
  documentId: string;
  unitIndex: number;
  unitLabel?: string | null;
  userComment?: string | null;
}

/**
 * Build seed text for relatedness from a theme step + optional packed unit body.
 * Prefers unit body and free-text comment; unit labels that are only numbers
 * (e.g. "27", "CIC 27") are not used alone so they do not pollute content terms.
 */
export function seedTextFromStep(
  step: ThemeStepSeed,
  unitBody?: string | null,
): string {
  const comment = (step.userComment || '').trim();
  const body = stripLeadingConsecutivo((unitBody || '').trim());
  if (body) {
    return (comment ? comment + ' ' + body : body).replace(/\s+/g, ' ').trim();
  }
  if (comment) return comment;
  // Label only when it carries words (not pure point numbers).
  const label = (step.unitLabel || '').trim();
  if (label && /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(label)) {
    const stripped = label.replace(/^[A-Za-z]{1,6}\s+/u, '').trim();
    // Drop labels that are only digits after stripping a short doc code.
    if (stripped && !/^\d+([,-]\d+)*$/.test(stripped)) return label;
  }
  return '';
}

/** Prefer last step as the “current” pasaje for suggestions. */
export function pickSeedStep(
  steps: ThemeStepSeed[] | null | undefined,
): ThemeStepSeed | null {
  if (!steps?.length) return null;
  return steps[steps.length - 1] ?? null;
}

function plainSnippet(contenido: string | undefined, max = 140): string {
  const raw = (contenido || '')
    .replace(/\[\+\[\d+\]\+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (raw.length <= max) return raw;
  return raw.slice(0, max - 1).trimEnd() + '…';
}

function unitChromeLabel(
  documentId: string,
  unitIndex: number,
  unit: SearchUnit | undefined,
): string {
  const consec =
    unit?.consecutivo && unit.consecutivo !== 'no-encontrado'
      ? unit.consecutivo
      : String(unitIndex);
  return `${documentId || 'doc'} · Nº ${consec}`;
}

/** Map ranked hits to list rows using unit bodies from the same doc inputs. */
export function mapHitsToRelatedRows(
  hits: RankedUnitHit[],
  docs: SearchDocumentInput[],
): RelatedCitationRow[] {
  const byId = new Map(docs.map((d) => [d.documentId, d]));
  return hits.map((h) => {
    const doc = byId.get(h.documentId);
    const unit = doc?.units?.[h.unitIndex];
    return {
      documentId: h.documentId,
      unitIndex: h.unitIndex,
      consecutivo: h.consecutivo ?? unit?.consecutivo,
      score: h.score,
      title: unitChromeLabel(h.documentId, h.unitIndex, unit),
      snippet: plainSnippet(unit?.contenido),
      matchedTerms: h.matchedTerms ?? [],
    };
  });
}

/** Seed text + corpus slice → related citation rows (product entry). */
export function suggestRelatedCitations(
  sourceText: string,
  docs: SearchDocumentInput[],
  opts: {
    exclude?: { documentId: string; unitIndex: number };
    limit?: number;
  } = {},
): RelatedCitationRow[] {
  const text = (sourceText || '').trim();
  if (!text || !docs.length) return [];
  const hits = findRelatedUnits(text, docs, {
    exclude: opts.exclude,
    limit: opts.limit ?? 8,
  });
  return mapHitsToRelatedRows(hits, docs);
}

/** Theme step → neighbors with stable citations (excludes the seed step). */
export function suggestRelatedForStep(
  step: ThemeStepSeed,
  docs: SearchDocumentInput[],
  opts: { limit?: number } = {},
): RelatedCitationRow[] {
  const doc = docs.find((d) => d.documentId === step.documentId);
  const unit = doc?.units?.[step.unitIndex];
  const seed = seedTextFromStep(step, unit?.contenido);
  if (!seed) return [];
  return suggestRelatedCitations(seed, docs, {
    exclude: { documentId: step.documentId, unitIndex: step.unitIndex },
    limit: opts.limit ?? 8,
  });
}

/**
 * Narrative glue that must not drive saint-cover relatedness alone.
 * Folded surfaces; kept here so ranking stays independent of santoral module.
 */
export const SAINT_RELATED_RANK_NOISE: ReadonlySet<string> = new Set([
  'actualmente',
  'ano',
  'anos',
  'capital',
  'ciudad',
  'condenado',
  'cristiano',
  'cristianos',
  'emperador',
  'emperadores',
  'epoca',
  'iglesia',
  'imperio',
  'joven',
  'jovenes',
  'muerte',
  'obispo',
  'obispos',
  'padre',
  'roma',
  'romana',
  'romano',
  'san',
  'santa',
  'santo',
  'siglo',
  'tiempo',
  'vida',
  'vicario',
]);

/** Cap hits per document so one huge author pack cannot fill the list. */
export function diversifyRelatedHitsByDocument(
  hits: RankedUnitHit[],
  maxPerDocument = 2,
): RankedUnitHit[] {
  const cap = Math.max(1, maxPerDocument);
  const counts = new Map<string, number>();
  const out: RankedUnitHit[] = [];
  for (const h of hits) {
    const id = h.documentId || '';
    const n = counts.get(id) ?? 0;
    if (n >= cap) continue;
    counts.set(id, n + 1);
    out.push(h);
  }
  return out;
}

/**
 * Whether a related hit is strong enough for a saint cover (not a theme note).
 * Requires multi-term overlap or one rare long anchor; drops pure noise matches.
 */
export function isQualitySaintRelatedHit(
  hit: RankedUnitHit,
  seedTerms: string[],
  opts: { minScore?: number; topScore?: number } = {},
): boolean {
  const minScore = opts.minScore ?? 1.8;
  const topScore = opts.topScore ?? hit.score;
  if (hit.score < minScore) return false;
  if (topScore > 0 && hit.score < topScore * 0.4) return false;

  const matched = (hit.matchedTerms || []).filter(Boolean);
  if (!matched.length) return false;

  const seedSet = new Set(seedTerms);
  const substantive = matched.filter(
    (t) =>
      !SAINT_RELATED_RANK_NOISE.has(t) &&
      t.length >= 3 &&
      (seedSet.size === 0 || seedSet.has(t)),
  );
  if (!substantive.length) return false;

  // Prefer 2+ seed anchors; allow a single rare proper-noun-ish token.
  if (substantive.length >= 2) return true;
  const only = substantive[0];
  return only.length >= 6 && hit.score >= Math.max(minScore, 2.2);
}

/**
 * Related rows for a saint cover: stricter than theme-step neighbors.
 * Empty list when the corpus only has weak lexical noise (preferred UX).
 */
export function suggestRelatedForSaint(
  sourceText: string,
  docs: SearchDocumentInput[],
  opts: {
    limit?: number;
    /** Soft boost for works already linked to the saint (documentIds). */
    preferDocumentIds?: string[];
    maxPerDocument?: number;
  } = {},
): RelatedCitationRow[] {
  const text = (sourceText || '').trim();
  if (!text || !docs.length) return [];

  const rawTerms = contentTermsFromText(text).filter(
    (t) => !SAINT_RELATED_RANK_NOISE.has(t) && t.length >= 3,
  );
  if (rawTerms.length < 2) return [];

  // Slightly wider kernel than theme relatedness; still capped.
  const contentTerms = pickRelatedContentTerms(rawTerms, 6);
  if (contentTerms.length < 2) return [];

  const seedPhrase = contentTerms.join(' ');
  const parsed: ParsedSearch = {
    empty: false,
    phrases: [seedPhrase],
    contentTerms,
    points: [],
  };
  const prefer = new Set(
    (opts.preferDocumentIds || []).map((id) => String(id || '').trim()).filter(Boolean),
  );

  let hits = rankUnitsAcrossDocuments(docs, parsed, {
    requireMultiTermOverlap: true,
  });

  // Soft boost linked works (Padres) without inventing hits.
  if (prefer.size) {
    hits = hits
      .map((h) =>
        prefer.has(h.documentId)
          ? { ...h, score: Math.round((h.score + 1.1) * 1000) / 1000 }
          : h,
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.documentId.localeCompare(b.documentId) ||
          a.unitIndex - b.unitIndex,
      );
  }

  if (!hits.length) return [];
  const topScore = hits[0].score;
  // Absolute floor: weak single-word-ish piles never surface on the cover.
  if (topScore < 2.0) return [];

  const quality = hits.filter((h) =>
    isQualitySaintRelatedHit(h, contentTerms, {
      minScore: 1.8,
      topScore,
    }),
  );
  if (!quality.length) return [];

  const diversified = diversifyRelatedHitsByDocument(
    quality,
    opts.maxPerDocument ?? 2,
  );
  const limit = opts.limit ?? 8;
  return mapHitsToRelatedRows(diversified.slice(0, limit), docs);
}

/** Convert loaded corpus shape to {@link SearchDocumentInput}. */
export function toSearchDocumentInput(
  documentId: string,
  index: SearchDocumentInput['index'],
  units: SearchUnit[],
): SearchDocumentInput {
  return {
    documentId,
    index,
    units: units.map((u, i) => ({
      ...u,
      unitIndex: typeof u.unitIndex === 'number' ? u.unitIndex : i,
      index_array: typeof u.index_array === 'number' ? u.index_array : i,
    })),
  };
}
