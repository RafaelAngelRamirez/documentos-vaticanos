/**
 * Pure papacy pack helpers (no Angular).
 */

import type {
  PapacyDocRef,
  PapacyManifest,
  PapalDocumentGenre,
  PapalWorkRef,
  PopeRecord,
} from './papacy.models';

export const PAPACY_MANIFEST_URL = 'assets/corpus/papacy/manifest.json';
export const PAPACY_DOCUMENTS_URL = 'assets/corpus/papacy/documents.json';

export function popeById(
  id: string,
  popes: PopeRecord[],
): PopeRecord | undefined {
  return popes.find((p) => p.id === id);
}

/** Group by era, keep Annuario order (ordinal) inside each era. */
export function popesByEra(
  popes: PopeRecord[],
): { era: string; items: PopeRecord[] }[] {
  const map = new Map<string, PopeRecord[]>();
  const order: string[] = [];
  for (const p of popes) {
    const era = p.era || 'Otros';
    if (!map.has(era)) {
      map.set(era, []);
      order.push(era);
    }
    map.get(era)!.push(p);
  }
  return order.map((era) => ({
    era,
    items: (map.get(era) || [])
      .slice()
      .sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0)),
  }));
}

export function initialsForPope(pope: PopeRecord): string {
  if (pope.initials) return pope.initials;
  const parts = (pope.name || '')
    .replace(/^(San|Santa|Santo|Beato|Beata)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function filterPopes(popes: PopeRecord[], q: string): PopeRecord[] {
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return popes;
  return popes.filter((p) => {
    const blob = [
      p.name,
      p.displayName,
      p.secularName,
      p.id,
      String(p.ordinal),
      p.years,
      p.birthplace,
      p.saintId,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(needle);
  });
}

export function documentIdsForPope(
  pope: PopeRecord,
  docs: PapacyDocRef[],
): string[] {
  const set = new Set<string>(pope.documentIds || []);
  const urls = new Set(
    (pope.works || [])
      .map((w) => w.documentId)
      .filter((id): id is string => !!id),
  );
  for (const id of urls) set.add(id);
  void docs;
  return Array.from(set).sort();
}

export function popeForDocument(
  doc: PapacyDocRef,
  popes: PopeRecord[],
): PopeRecord | undefined {
  if (!doc?.id) return undefined;
  for (const p of popes) {
    if ((p.documentIds || []).includes(doc.id)) return p;
    if ((p.works || []).some((w) => w.documentId === doc.id)) return p;
  }
  return undefined;
}

export function siblingDocumentIds(
  doc: PapacyDocRef,
  popes: PopeRecord[],
): string[] {
  const pope = popeForDocument(doc, popes);
  if (!pope) return [];
  return (pope.documentIds || []).filter((id) => id !== doc.id);
}

/** Prefer one locale twin per work (es, then en, then any). */
export function preferLocaleDocumentIds(
  ids: string[],
  locale = 'es',
): string[] {
  const stem = (id: string) =>
    id.replace(/-(en-ai|es|en|hi|zh|ar|la|it|fr|de|pt)$/i, '');
  const locOf = (id: string) => {
    const m = id.match(/-(en-ai|es|en|hi|zh|ar|la|it|fr|de|pt)$/i);
    return m ? m[1].toLowerCase() : '';
  };
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const s = stem(id);
    const arr = groups.get(s) || [];
    arr.push(id);
    groups.set(s, arr);
  }
  const rank = (id: string) => {
    const loc = locOf(id);
    if (loc === locale) return 0;
    if (loc === 'es') return 1;
    if (loc === 'en') return 2;
    return 3;
  };
  return Array.from(groups.values()).map(
    (arr) => arr.slice().sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0],
  );
}

export function corpusWorks(pope: PopeRecord): PapalWorkRef[] {
  const fromIds = (pope.documentIds || []).map((id) => {
    const w = (pope.works || []).find((x) => x.documentId === id);
    return (
      w || {
        title: id,
        documentId: id,
        inCorpus: true,
      }
    );
  });
  const extra = (pope.works || []).filter(
    (w) => w.inCorpus && w.documentId && !(pope.documentIds || []).includes(w.documentId),
  );
  return [...fromIds, ...extra];
}

export function pendingWorks(
  pope: PopeRecord,
  genre?: PapalDocumentGenre,
): PapalWorkRef[] {
  return (pope.works || []).filter((w) => {
    if (w.inCorpus || w.documentId) return false;
    if (genre && w.genre !== genre) return false;
    return !!w.sourceUrl;
  });
}

export const GENRE_LABEL_ES: Record<PapalDocumentGenre, string> = {
  'apostolic-letter': 'Carta apostólica',
  encyclical: 'Encíclica',
  'apostolic-exhortation': 'Exhortación apostólica',
  'apostolic-constitution': 'Constitución apostólica',
  'motu-proprio': 'Motu proprio',
  bull: 'Bula',
  letter: 'Carta',
  other: 'Documento',
};

export type { PapacyManifest, PopeRecord, PapalWorkRef };
