/**
 * Parse vatican.va papal document index pages (apostolic letters, encyclicals…).
 * Pure HTML → catalog entries. Network lives in import_papacy.ts / crawl script.
 */

import {
  CONTENT_HUB_TO_POPE,
  genreFromUrl,
} from './match_corpus';
import type { PapalDocumentGenre, PapalWorkRef } from '../../models/papacy.model';
import { decodeHtmlEntities, absoluteVaticanUrl } from './parse_holy_father_list';

export interface CataloguedPapalDoc extends PapalWorkRef {
  popeId: string;
  contentSlug?: string;
  indexUrl?: string;
}

const GENRE_PATH: Record<string, PapalDocumentGenre> = {
  apost_letters: 'apostolic-letter',
  encyclicals: 'encyclical',
  apost_exhortations: 'apostolic-exhortation',
  apost_constitutions: 'apostolic-constitution',
  motu_proprio: 'motu-proprio',
  bulls: 'bull',
  letters: 'letter',
};

const DOC_HREF =
  /href=["']([^"']+\/(?:apost_letters|encyclicals|apost_exhortations|apost_constitutions|motu_proprio|bulls|letters)\/[^"']+\.html)["']/gi;

const YEAR_INDEX =
  /href=["']([^"']+\/(?:apost_letters|letters|encyclicals)\/\d{4}(?:\.index)?\.html)["']/gi;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleNearHref(html: string, href: string): string {
  const idx = html.indexOf(href);
  if (idx < 0) return '';
  const window = html.slice(Math.max(0, idx - 800), idx + href.length + 400);
  const h = window.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (h) {
    const t = decodeHtmlEntities(stripTags(h[1]));
    if (t.length > 8) return t;
  }
  const em = window.match(/<em[^>]*>([\s\S]*?)<\/em>/i);
  if (em) {
    const t = decodeHtmlEntities(stripTags(em[1]));
    if (t.length > 2) return t;
  }
  return '';
}

function dateFromTitleOrHref(title: string, href: string): string | undefined {
  const fromTitle = title.match(
    /\((\d{1,2}\s+de\s+[a-záéíóú]+(?:\s+de)?\s+\d{4}|\d{1,2}\s+[a-z]+\s+\d{4}|[0-9.]{4,10})\)/i,
  );
  if (fromTitle) return fromTitle[1];
  const fromHref = href.match(/\/(\d{8}|\d{4}\d{2}\d{2}|\d{4})[^/]*\.html/i);
  if (fromHref) return fromHref[1];
  return undefined;
}

function localeFromUrl(url: string): string | undefined {
  const m = url.match(
    /\/content\/[^/]+\/([a-z]{2}(?:_[a-z]{2})?)\//i,
  );
  return m ? m[1].toLowerCase() : undefined;
}

function popeIdFromHref(href: string): string | null {
  const m = href.match(/\/content\/([^/]+)\//i);
  if (!m) return null;
  const hub = m[1].toLowerCase();
  return CONTENT_HUB_TO_POPE[hub] || null;
}

export function extractYearIndexUrls(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  YEAR_INDEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YEAR_INDEX.exec(html)) !== null) {
    const abs = absoluteVaticanUrl(m[1]);
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  // Relative year links already covered. Keep pageUrl unused except for debug.
  void pageUrl;
  return out;
}

/**
 * Pull document links from a vatican.va papal index (or year sub-index).
 */
export function parsePapalIndexHtml(
  html: string,
  indexUrl: string,
): CataloguedPapalDoc[] {
  const out: CataloguedPapalDoc[] = [];
  const seen = new Set<string>();
  DOC_HREF.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DOC_HREF.exec(html)) !== null) {
    const href = m[1];
    if (/\.index\.html$/i.test(href)) continue;
    const abs = absoluteVaticanUrl(href);
    if (seen.has(abs)) continue;
    seen.add(abs);
    const popeId = popeIdFromHref(abs);
    if (!popeId) continue;
    const loc = localeFromUrl(abs);
    const title = titleNearHref(html, href) || abs.split('/').pop() || abs;
    const content = abs.match(/\/content\/([^/]+)\//i);
    const pathGenre = Object.keys(GENRE_PATH).find((g) =>
      abs.toLowerCase().includes(`/${g}/`),
    );
    out.push({
      popeId,
      title,
      sourceUrl: abs,
      genre: pathGenre ? GENRE_PATH[pathGenre] : genreFromUrl(abs),
      date: dateFromTitleOrHref(title, abs),
      locale: loc,
      contentSlug: content ? content[1] : undefined,
      indexUrl,
      inCorpus: false,
    });
  }
  return out;
}

export function dedupeCatalog(docs: CataloguedPapalDoc[]): CataloguedPapalDoc[] {
  const byUrl = new Map<string, CataloguedPapalDoc>();
  for (const d of docs) {
    const key = (d.sourceUrl || '').replace(/https?:\/\/(www\.)?vatican\.va/i, '');
    if (!key) continue;
    const prev = byUrl.get(key);
    if (!prev) {
      byUrl.set(key, d);
      continue;
    }
    // Prefer ES title/locale when merging language twins of the same path.
    if (d.locale === 'es' && prev.locale !== 'es') {
      byUrl.set(key, { ...prev, ...d, title: d.title || prev.title });
    } else if ((d.title || '').length > (prev.title || '').length) {
      byUrl.set(key, { ...prev, title: d.title });
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => {
    const po = a.popeId.localeCompare(b.popeId);
    if (po) return po;
    return (a.date || '').localeCompare(b.date || '') || a.title.localeCompare(b.title, 'es');
  });
}

/** Hubs that actually publish apostolic-letter indexes on vatican.va. */
export const PAPAL_ARCHIVE_HUBS: Array<{
  popeId: string;
  contentSlug: string;
}> = [
  { popeId: 'leon-xiv', contentSlug: 'leo-xiv' },
  { popeId: 'francisco', contentSlug: 'francesco' },
  { popeId: 'benedicto-xvi', contentSlug: 'benedict-xvi' },
  { popeId: 'juan-pablo-ii', contentSlug: 'john-paul-ii' },
  { popeId: 'juan-pablo-i', contentSlug: 'john-paul-i' },
  { popeId: 'pablo-vi', contentSlug: 'paul-vi' },
  { popeId: 'juan-xxiii', contentSlug: 'john-xxiii' },
  { popeId: 'pio-xii', contentSlug: 'pius-xii' },
  { popeId: 'pio-xi', contentSlug: 'pius-xi' },
  { popeId: 'pio-x', contentSlug: 'pius-x' },
  { popeId: 'leon-xiii', contentSlug: 'leo-xiii' },
  { popeId: 'pio-ix', contentSlug: 'pius-ix' },
];

export const PAPAL_INDEX_GENRES = [
  'apost_letters',
  'encyclicals',
  'apost_exhortations',
  'apost_constitutions',
  'motu_proprio',
] as const;

export function indexUrlFor(
  contentSlug: string,
  genre: string,
  locale = 'es',
): string {
  return `https://www.vatican.va/content/${contentSlug}/${locale}/${genre}.index.html`;
}
