/**
 * Catalog taxonomy from document kind / family — not hardcoded *-es ids.
 */

export type CatalogKind =
  | 'catechism'
  | 'bible'
  | 'council'
  | 'magisterium'
  | 'patristic'
  | 'canon-law'
  | 'liturgy'
  | 'encyclical'
  | 'other';

export type CatalogTab =
  | 'Todos'
  | 'Concilios'
  | 'Magisterio'
  | 'Catecismo'
  | 'Escritura'
  | 'Padres'
  | 'Derecho'
  | 'Liturgia';

export const CATALOG_TABS: CatalogTab[] = [
  'Todos',
  'Concilios',
  'Magisterio',
  'Catecismo',
  'Escritura',
  'Padres',
  'Derecho',
  'Liturgia',
];

export interface CatalogMeta {
  id: string;
  title: string;
  shortTitle?: string;
  kind: CatalogKind;
  locale: string;
  translationProvenance?: 'ai' | 'human' | 'source';
  sourceNote?: string;
  sourceUrl?: string;
}

const KIND_TAB: Record<CatalogKind, CatalogTab | null> = {
  catechism: 'Catecismo',
  bible: 'Escritura',
  council: 'Concilios',
  magisterium: 'Magisterio',
  encyclical: 'Magisterio',
  patristic: 'Padres',
  'canon-law': 'Derecho',
  liturgy: 'Liturgia',
  other: null,
};

const NAME_KIND: Array<{ re: RegExp; kind: CatalogKind }> = [
  { re: /catecismo|catechism|cic\b/i, kind: 'catechism' },
  { re: /biblia|bible|escritura|evangelio/i, kind: 'bible' },
  { re: /concilio|vaticano\s*ii|nicea|trento|constantinopla/i, kind: 'council' },
  { re: /enc[ií]clica|laudato|lumen|fides/i, kind: 'encyclical' },
  { re: /c[oó]digo|canon|cceo/i, kind: 'canon-law' },
  { re: /misal|igmr|liturg/i, kind: 'liturgy' },
  { re: /agust[ií]n|atanasio|padre|patrist/i, kind: 'patristic' },
];

export function familyKey(id: string): string {
  return (id || '').replace(/-(es|en|zh|hi|ar|la)$/i, '') || id;
}

export function localeFromId(id: string): string {
  const m = (id || '').match(/-(es|en|zh|hi|ar|la)$/i);
  return m ? m[1].toLowerCase() : 'es';
}

export function kindFromName(
  nombre: string,
  explicit?: CatalogKind | string | null
): CatalogKind {
  if (explicit && KIND_TAB[explicit as CatalogKind] !== undefined) {
    return explicit as CatalogKind;
  }
  const n = nombre || '';
  for (const row of NAME_KIND) {
    if (row.re.test(n)) return row.kind;
  }
  return 'other';
}

export function tabForKind(kind: CatalogKind): CatalogTab | null {
  return KIND_TAB[kind] ?? null;
}

export function kindLabel(kind: CatalogKind): string {
  const labels: Record<CatalogKind, string> = {
    catechism: 'Catecismo',
    bible: 'Sagrada Escritura',
    council: 'Concilio',
    magisterium: 'Magisterio',
    encyclical: 'Encíclica',
    patristic: 'Padres de la Iglesia',
    'canon-law': 'Derecho canónico',
    liturgy: 'Liturgia',
    other: 'Documento',
  };
  return labels[kind];
}

export function localeLabel(locale: string): string {
  const map: Record<string, string> = {
    es: 'Español',
    en: 'English',
    zh: '中文',
    hi: 'हिन्दी',
    ar: 'العربية',
    la: 'Latine',
  };
  return map[(locale || 'es').toLowerCase()] || locale;
}

export function provenanceBadge(meta: {
  locale?: string;
  translationProvenance?: string;
}): string | null {
  const loc = (meta.locale || 'es').toUpperCase();
  if (meta.translationProvenance === 'ai') return `${loc}(IA)`;
  if ((meta.locale || '') === 'la') return 'LA';
  return loc === 'ES' ? null : loc;
}

export function displayTitle(meta: {
  title?: string;
  shortTitle?: string;
  nombre?: string;
}): string {
  return (meta.title || meta.nombre || meta.shortTitle || '').trim();
}

export function filterByTab<T extends { kind: CatalogKind }>(
  items: T[],
  tab: CatalogTab
): T[] {
  if (tab === 'Todos') return items;
  return items.filter((item) => tabForKind(item.kind) === tab);
}

export function liveTabs<T extends { kind: CatalogKind }>(items: T[]): CatalogTab[] {
  const present = new Set<CatalogTab>();
  for (const item of items) {
    const tab = tabForKind(item.kind);
    if (tab) present.add(tab);
  }
  return CATALOG_TABS.filter((t) => t === 'Todos' || present.has(t));
}

export function preferredEdition<T extends { id: string; locale?: string }>(
  editions: T[],
  contentLocale: string
): T | undefined {
  const loc = (contentLocale || 'es').toLowerCase();
  return (
    editions.find((e) => (e.locale || localeFromId(e.id)) === loc) ||
    editions.find((e) => (e.locale || localeFromId(e.id)) === 'es') ||
    editions[0]
  );
}
