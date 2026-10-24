/**
 * Pure santoral ↔ corpus resolve (no Angular, no relative TS imports).
 * Testable with: node --experimental-strip-types …
 */

export interface SaintRecord {
  id: string;
  name: string;
  displayName?: string;
  feastDays?: string[];
  years?: string;
  death?: string;
  role?: string;
  bio?: string;
  sourceUrl?: string;
  locale?: string;
  authorAliases?: string[];
  documentIds?: string[];
  themes?: string[];
  quote?: string;
  quoteSource?: string;
  era?: string;
  eraLabel?: string;
  initials?: string;
  meta?: string;
}

export interface SantoralManifest {
  version: string;
  generatedAt?: string;
  sourceNote?: string;
  saints: SaintRecord[];
}

export interface SantoralDocRef {
  id: string;
  title?: string;
  author?: string;
}

/** Offline pack path relative to app assets (shipped with corpus). */
export const SANTORAL_MANIFEST_URL = 'assets/corpus/santoral/manifest.json';

/**
 * Normalize person names for author ↔ saint matching.
 * Strips diacritics, san/santa/beato prefixes, punctuation.
 */
export function normalizePersonKey(raw: string | undefined | null): string {
  if (!raw) return '';
  let s = String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase();
  s = s.replace(/^(san|santa|santo|beato|beata|blessed|st\.?|s\.)\s+/i, '');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return s;
}

function saintKeys(saint: SaintRecord): string[] {
  const keys = [saint.name, saint.displayName, ...(saint.authorAliases || [])]
    .map((x) => normalizePersonKey(x))
    .filter(Boolean);
  return Array.from(new Set(keys));
}

/** True when corpus author string refers to this saint. */
export function matchAuthorToSaint(
  author: string | undefined | null,
  saint: SaintRecord,
): boolean {
  const a = normalizePersonKey(author);
  if (!a) return false;
  for (const k of saintKeys(saint)) {
    if (!k) continue;
    if (a === k) return true;
    // "agustin de hipona" vs "agustin"; prefer multi-token containment either way
    if (a.includes(k) || k.includes(a)) return true;
  }
  return false;
}

/**
 * All corpus document ids related to a saint: explicit list ∪ author match.
 * Sorted for stable UI / tests.
 */
export function documentIdsForSaint(
  saint: SaintRecord,
  docs: SantoralDocRef[],
): string[] {
  const set = new Set<string>(saint.documentIds || []);
  for (const d of docs) {
    if (!d?.id) continue;
    if (matchAuthorToSaint(d.author, saint)) set.add(d.id);
  }
  return Array.from(set).sort();
}

/**
 * Find the saint for a document: explicit documentIds first, then author match.
 */
export function saintForDocument(
  doc: SantoralDocRef,
  saints: SaintRecord[],
): SaintRecord | undefined {
  if (!doc?.id) return undefined;
  for (const s of saints) {
    if ((s.documentIds || []).includes(doc.id)) return s;
  }
  if (doc.author) {
    for (const s of saints) {
      if (matchAuthorToSaint(doc.author, s)) return s;
    }
  }
  return undefined;
}

/** Sibling works of the same saint, excluding the current document. */
export function siblingDocumentIds(
  doc: SantoralDocRef,
  saints: SaintRecord[],
  docs: SantoralDocRef[],
): string[] {
  const saint = saintForDocument(doc, saints);
  if (!saint) return [];
  return documentIdsForSaint(saint, docs).filter((id) => id !== doc.id);
}

export function saintById(
  id: string,
  saints: SaintRecord[],
): SaintRecord | undefined {
  return saints.find((s) => s.id === id);
}

/** Group saints by era label for list UI (unknown era last). */
export function saintsByEra(
  saints: SaintRecord[],
): { era: string; items: SaintRecord[] }[] {
  const map = new Map<string, SaintRecord[]>();
  for (const s of saints) {
    const era = s.era || 'Otros';
    const list = map.get(era) || [];
    list.push(s);
    map.set(era, list);
  }
  const eras = Array.from(map.keys()).sort((a, b) => {
    if (a === 'Otros') return 1;
    if (b === 'Otros') return -1;
    return a.localeCompare(b, 'es');
  });
  return eras.map((era) => ({
    era,
    items: (map.get(era) || []).slice().sort((a, b) =>
      (a.displayName || a.name).localeCompare(b.displayName || b.name, 'es'),
    ),
  }));
}

/** Initials helper for avatars when pack omits them. */
export function initialsForName(name: string): string {
  const parts = name
    .replace(/^(San|Santa|Santo|Beato|Beata)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
