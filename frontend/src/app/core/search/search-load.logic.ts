/**
 * Pure helpers for progressive / locale-scoped search loading (PR2a).
 * No Angular DI — safe for node tests.
 */

import { listSearchUniverse, type LocaleMeta } from '../corpus/document-locale.logic';

/** Minimal meta shape for locale / hub filtering. */
export interface SearchMetaLike {
  id: string;
  locale?: string;
  kind?: string;
  unitCount?: number;
  translationProvenance?: 'official' | 'ai' | string;
  sourceNote?: string;
}

/** Hub kinds for related / early topic postings (design KD17). */
export const SEARCH_HUB_KINDS: ReadonlySet<string> = new Set([
  'catechism',
  'magisterium',
  'council',
  'canon-law',
]);

/** Default pool sizes (design C.4 / KD25). */
export const DEFAULT_INDEX_LOAD_CONCURRENCY = 6;
export const DEFAULT_BODY_LOAD_CONCURRENCY = 4;
export const DEFAULT_RELATED_HUB_CAP = 40;

export function normalizeLocale(code?: string | null): string {
  if (!code) return '';
  return code.trim().toLowerCase().split(/[-_]/)[0] || '';
}

/**
 * Metas in the default query universe for search.
 * Resolved content locale: one edition per family, official over AI.
 * When allLocales is true, every language is included but AI siblings of an
 * official same-locale pack are still dropped.
 */
export function metasForSearchLocale(
  metas: readonly SearchMetaLike[],
  contentLocale: string,
  allLocales = false,
): SearchMetaLike[] {
  return listSearchUniverse(
    metas as LocaleMeta[],
    contentLocale,
    allLocales,
  );
}

/**
 * Hub docs for related lexical pool (capped). Prefer hub kinds; fill with
 * remaining locale docs only if under cap (still bounded).
 */
export function pickRelatedHubMetas(
  metas: readonly SearchMetaLike[],
  contentLocale: string,
  max = DEFAULT_RELATED_HUB_CAP,
  allLocales = false,
): SearchMetaLike[] {
  const scoped = metasForSearchLocale(metas, contentLocale, allLocales);
  const hubs = scoped.filter((m) => SEARCH_HUB_KINDS.has(m.kind || ''));
  // Prefer smaller hub packs first (faster cold related)
  hubs.sort(
    (a, b) =>
      (a.unitCount ?? 1e9) - (b.unitCount ?? 1e9) ||
      a.id.localeCompare(b.id),
  );
  if (hubs.length >= max) return hubs.slice(0, max);
  const hubIds = new Set(hubs.map((h) => h.id));
  const rest = scoped
    .filter((m) => !hubIds.has(m.id))
    .sort(
      (a, b) =>
        (a.unitCount ?? 1e9) - (b.unitCount ?? 1e9) ||
        a.id.localeCompare(b.id),
    );
  return [...hubs, ...rest].slice(0, max);
}

/**
 * Run async tasks with a concurrency pool (Promise-based).
 * Cancels further scheduling when `isCancelled()` returns true; already
 * started tasks still settle (caller should drop stale results via gen).
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  isCancelled?: () => boolean,
): Promise<R[]> {
  const n = Math.max(1, Math.min(concurrency || 1, items.length || 1));
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runOne(): Promise<void> {
    while (true) {
      if (isCancelled?.()) return;
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(n, items.length) }, () =>
    runOne(),
  );
  await Promise.all(workers);
  return results;
}
