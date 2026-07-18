/**
 * Multi-locale corpus editions: family grouping + preferred language pick.
 * Pure functions — no Angular DI, safe for node tests.
 */

/** Known content locale suffixes in document ids. */
export const KNOWN_LOCALE_SUFFIXES = [
  'es',
  'la',
  'en',
  'it',
  'fr',
  'de',
  'pt',
  'el',
] as const;

export type KnownLocale = (typeof KNOWN_LOCALE_SUFFIXES)[number];

/** Minimal meta shape used by grouping (matches DocumentMeta fields we need). */
export interface LocaleMeta {
  id: string;
  locale?: string;
  title?: string;
  shortTitle?: string;
  unitCount?: number;
  kind?: string;
  sourceUrl?: string;
  sourceNote?: string;
  author?: string;
  compiler?: string;
  bodyPath?: string;
  indexPath?: string;
}

export interface DocumentFamily<T extends LocaleMeta = LocaleMeta> {
  /** Stable base id without locale suffix (e.g. `nicea-i`, `cceo`). */
  key: string;
  editions: T[];
  /** Edition for the given preferred locale (after fallback). */
  preferred: T;
}

/** Pref value: concrete locale or follow device/browser. */
export type ContentLocalePref = 'system' | string;

const LOCALE_ORDER = ['es', 'la', 'en', 'it', 'fr', 'de', 'pt', 'el'];

const SUFFIX_RE = new RegExp(
  `-(${KNOWN_LOCALE_SUFFIXES.join('|')})$`,
  'i',
);

/**
 * Family key for a document pack id.
 * `nicea-i-es` + locale es → `nicea-i`
 * `constantinopla-i-la` → `constantinopla-i`
 * `cic-es` → `cic`
 * `bible-pueblo-de-dios-es` → `bible-pueblo-de-dios`
 * Unknown suffix / no locale → id as-is (singleton family).
 */
export function familyKey(id: string, locale?: string | null): string {
  if (!id) return '';
  const loc = (locale || '').toLowerCase().trim();
  if (loc && id.toLowerCase().endsWith(`-${loc}`)) {
    return id.slice(0, -(loc.length + 1));
  }
  const m = id.match(SUFFIX_RE);
  if (m) {
    return id.slice(0, -m[0].length);
  }
  return id;
}

/** Normalize BCP-47 / browser language to a short corpus locale (`es-MX` → `es`). */
export function normalizeLocaleCode(code?: string | null): string {
  if (!code) return '';
  const primary = code.trim().toLowerCase().split(/[-_]/)[0] || '';
  return primary;
}

/**
 * Resolve the effective content locale from prefs + environment.
 * @param pref `system` | concrete code
 * @param navigatorLanguage e.g. `navigator.language` (injectable for tests)
 * @param fallback default when system has no usable primary (`es`)
 */
export function resolveContentLocale(
  pref: ContentLocalePref | undefined | null,
  navigatorLanguage?: string | null,
  fallback = 'es',
): string {
  if (pref && pref !== 'system') {
    const n = normalizeLocaleCode(pref);
    if (n) return n;
  }
  const fromNav = normalizeLocaleCode(navigatorLanguage);
  if (fromNav) return fromNav;
  return fallback;
}

function localeOf(meta: LocaleMeta): string {
  if (meta.locale) return normalizeLocaleCode(meta.locale);
  const m = meta.id.match(SUFFIX_RE);
  return m ? m[1].toLowerCase() : '';
}

function editionSortKey(meta: LocaleMeta): string {
  const loc = localeOf(meta);
  const idx = LOCALE_ORDER.indexOf(loc);
  const rank = idx >= 0 ? idx : 99;
  return `${String(rank).padStart(2, '0')}:${loc}:${meta.id}`;
}

/**
 * Pick the best edition for the user's preferred content locale.
 * 1) exact locale match
 * 2) Spanish (corpus default)
 * 3) stable order (es, la, … then id)
 */
export function pickPreferredEdition<T extends LocaleMeta>(
  editions: T[],
  preferredLocale: string,
): T {
  if (!editions.length) {
    throw new Error('pickPreferredEdition: empty editions');
  }
  if (editions.length === 1) return editions[0];
  const pref = normalizeLocaleCode(preferredLocale);
  const exact = editions.find((e) => localeOf(e) === pref);
  if (exact) return exact;
  const es = editions.find((e) => localeOf(e) === 'es');
  if (es) return es;
  const sorted = [...editions].sort((a, b) =>
    editionSortKey(a).localeCompare(editionSortKey(b)),
  );
  return sorted[0];
}

/** Group corpus metas into multi-locale families; attach preferred edition. */
export function groupByFamily<T extends LocaleMeta>(
  metas: T[],
  preferredLocale: string,
): DocumentFamily<T>[] {
  const map = new Map<string, T[]>();
  for (const m of metas) {
    const key = familyKey(m.id, m.locale);
    const list = map.get(key);
    if (list) list.push(m);
    else map.set(key, [m]);
  }
  const families: DocumentFamily<T>[] = [];
  for (const [key, editions] of map) {
    const sorted = [...editions].sort((a, b) =>
      editionSortKey(a).localeCompare(editionSortKey(b)),
    );
    families.push({
      key,
      editions: sorted,
      preferred: pickPreferredEdition(sorted, preferredLocale),
    });
  }
  // Stable catalog order: by preferred title then id
  families.sort((a, b) => {
    const ta = (a.preferred.title || a.preferred.id).toLowerCase();
    const tb = (b.preferred.title || b.preferred.id).toLowerCase();
    const c = ta.localeCompare(tb, 'es');
    return c !== 0 ? c : a.key.localeCompare(b.key);
  });
  return families;
}

/** Collapse metas to one preferred edition per family (catalog listing). */
export function listPreferredEditions<T extends LocaleMeta>(
  metas: T[],
  preferredLocale: string,
): T[] {
  return groupByFamily(metas, preferredLocale).map((f) => f.preferred);
}

/** All editions sharing a family with `documentId` (including itself). */
export function editionsForDocument<T extends LocaleMeta>(
  metas: T[],
  documentId: string,
): T[] {
  const self = metas.find((m) => m.id === documentId);
  const key = familyKey(documentId, self?.locale);
  return metas
    .filter((m) => familyKey(m.id, m.locale) === key)
    .sort((a, b) => editionSortKey(a).localeCompare(editionSortKey(b)));
}

/** Human label for corpus locale codes (shared with CorpusService). */
export function localeLabel(locale?: string | null): string {
  if (!locale) return 'Idioma';
  const code = normalizeLocaleCode(locale);
  const map: Record<string, string> = {
    es: 'Español',
    en: 'English',
    la: 'Latina',
    it: 'Italiano',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português',
    el: 'Ελληνικά',
  };
  return map[code] || locale.toUpperCase();
}

/** Short badge (ES, LA) for chips / lector chrome. */
export function localeBadge(locale?: string | null): string {
  if (!locale) return '?';
  return normalizeLocaleCode(locale).toUpperCase() || '?';
}

/**
 * Unit index to open when switching language.
 * Same unitIndex only when both packs report equal unitCount; else 0.
 */
export function mapUnitIndexOnLocaleSwitch(
  fromUnitIndex: number,
  fromUnitCount?: number | null,
  toUnitCount?: number | null,
): number {
  const idx = Math.max(0, Math.floor(fromUnitIndex) || 0);
  if (
    typeof fromUnitCount === 'number' &&
    typeof toUnitCount === 'number' &&
    fromUnitCount > 0 &&
    fromUnitCount === toUnitCount &&
    idx < toUnitCount
  ) {
    return idx;
  }
  return 0;
}

/** Subtitle for catalog when multiple editions exist. */
export function multiLocaleSubtitle(editions: LocaleMeta[]): string | null {
  if (editions.length < 2) return null;
  const labels = editions.map((e) => localeLabel(localeOf(e) || e.locale));
  // Unique preserve order
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const l of labels) {
    if (!seen.has(l)) {
      seen.add(l);
      uniq.push(l);
    }
  }
  if (uniq.length < 2) return null;
  return `${uniq.join(' · ')}`;
}
