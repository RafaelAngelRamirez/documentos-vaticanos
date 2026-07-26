/**
 * Pure helpers for progressive / locale-scoped search loading (PR2a).
 * No Angular DI — safe for node tests.
 */

/** Minimal meta shape for locale / hub filtering. */
export interface SearchMetaLike {
  id: string;
  locale?: string;
  kind?: string;
  unitCount?: number;
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
 * When allLocales is true, returns all metas (opt-in “todos los idiomas”).
 */
export function metasForSearchLocale(
  metas: readonly SearchMetaLike[],
  contentLocale: string,
  allLocales = false,
): SearchMetaLike[] {
  if (!metas?.length) return [];
  if (allLocales) return [...metas];
  const loc = normalizeLocale(contentLocale);
  if (!loc) return [...metas];
  return metas.filter((m) => {
    const ml = normalizeLocale(m.locale);
    if (ml && ml === loc) return true;
    // Fallback: id suffix when locale field missing
    if (!ml && m.id.toLowerCase().endsWith(`-${loc}`)) return true;
    return false;
  });
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
