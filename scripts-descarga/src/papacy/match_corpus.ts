/**
 * Attribute corpus packs to a pope from vatican.va sourceUrl (and known hubs).
 * Does not rewrite corpus files — only returns document ids per pope.
 */

import type { PapalDocumentGenre } from '../../models/papacy.model';

export interface CorpusDocLite {
  id: string;
  title?: string;
  sourceUrl?: string;
  author?: string;
  locale?: string;
}

/** /content/{hub}/ → pope pack id (modern holy-father archives). */
export const CONTENT_HUB_TO_POPE: Record<string, string> = {
  francesco: 'francisco',
  'leo-xiv': 'leon-xiv',
  'leone-xiv': 'leon-xiv',
  'benedict-xvi': 'benedicto-xvi',
  'benedetto-xvi': 'benedicto-xvi',
  'john-paul-ii': 'juan-pablo-ii',
  'giovanni-paolo-ii': 'juan-pablo-ii',
  'john-paul-i': 'juan-pablo-i',
  'giovanni-paolo-i': 'juan-pablo-i',
  'paul-vi': 'pablo-vi',
  'paolo-vi': 'pablo-vi',
  'john-xxiii': 'juan-xxiii',
  'giovanni-xxiii': 'juan-xxiii',
  'pius-xii': 'pio-xii',
  'pio-xii': 'pio-xii',
  'pius-xi': 'pio-xi',
  'pio-xi': 'pio-xi',
  'pius-x': 'pio-x',
  'pio-x': 'pio-x',
  'pius-ix': 'pio-ix',
  'pio-ix': 'pio-ix',
  'leo-xiii': 'leon-xiii',
  'leone-xiii': 'leon-xiii',
  'gregorius-ix': 'gregorio-ix',
  'innocentius-iv': 'inocencio-iv',
  'urbanus-iv': 'urbano-iv',
  'benedictus-xii': 'benedicto-xii',
  'clemens-vi': 'clemente-vi',
  'eugenius-iv': 'eugenio-iv',
};

const SKIP_HUBS = new Set([
  'vatican',
  'romancuria',
  'photogallery',
  'news_services',
  'archive',
  'roman_curia',
]);

export function genreFromUrl(url: string): PapalDocumentGenre {
  const u = String(url || '').toLowerCase();
  if (/apost_letters|\/apl_|lettera-ap|carta-apostolica/.test(u)) {
    return 'apostolic-letter';
  }
  if (/encyclicals|\/enc_|encyclica/.test(u)) return 'encyclical';
  if (/apost_exhortations|\/exh_/.test(u)) return 'apostolic-exhortation';
  if (/apost_constitutions|\/apc_/.test(u)) return 'apostolic-constitution';
  if (/motu_proprio|motu-proprio/.test(u)) return 'motu-proprio';
  if (/\/bulls\//.test(u)) return 'bull';
  if (/\/letters\//.test(u)) return 'letter';
  return 'other';
}

/**
 * Pope pack id from a vatican.va (or legacy holy_father) URL, or null.
 */
export function popeIdFromSourceUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const u = String(url);
  const content = u.match(/\/content\/([^/]+)\//i);
  if (content) {
    const hub = content[1].toLowerCase();
    if (SKIP_HUBS.has(hub)) return null;
    if (CONTENT_HUB_TO_POPE[hub]) return CONTENT_HUB_TO_POPE[hub];
  }
  const holy = u.match(/\/holy_father\/([^/]+)\//i);
  if (holy) {
    const slug = holy[1].toLowerCase().replace(/_/g, '-');
    if (CONTENT_HUB_TO_POPE[slug]) return CONTENT_HUB_TO_POPE[slug];
  }
  return null;
}

export interface CorpusLink {
  popeId: string;
  documentId: string;
  title: string;
  sourceUrl?: string;
  genre: PapalDocumentGenre;
  locale?: string;
}

export function linkCorpusToPopes(docs: CorpusDocLite[]): CorpusLink[] {
  const out: CorpusLink[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    if (!d?.id) continue;
    const popeId = popeIdFromSourceUrl(d.sourceUrl);
    if (!popeId) continue;
    const key = `${popeId}::${d.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      popeId,
      documentId: d.id,
      title: d.title || d.id,
      sourceUrl: d.sourceUrl,
      genre: genreFromUrl(d.sourceUrl || ''),
      locale: d.locale,
    });
  }
  return out;
}
