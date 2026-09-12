/**
 * Stable corpus ids from vatican.va papal document filenames.
 */

export function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    return last.replace(/\.html?$/i, '');
  } catch {
    const last = String(url).split('/').filter(Boolean).pop() || '';
    return last.replace(/\.html?$/i, '');
  }
}

export function dateFromFilename(fn: string): string | undefined {
  const m = fn.match(/(?:^|_|-)(\d{8})(?:_|-|$)/);
  return m ? m[1] : undefined;
}

/**
 * Human slug (incipit / filename tail) without pope prefix or date.
 */
export function slugFromFilename(fn: string): string {
  let s = String(fn || '').replace(/\.html?$/i, '');
  s = s.replace(/^hf_[a-z0-9-]+_(enc|apl|exh|apc|motu-proprio)_/i, '');
  s = s.replace(/^papa-francesco-motu-proprio-\d{8}_/i, '');
  s = s.replace(/^papa-francesco_\d{8}_/i, '');
  s = s.replace(/^papa-francesco[-_]/i, '');
  s = s.replace(/^\d{8}[-_]/, '');
  s = s.replace(
    /^(enciclica|lettera-ap|motu-proprio|exhortacion|apost-letter)[-_]/i,
    '',
  );
  s = s.toLowerCase().replace(/_/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s || 'doc';
}

const GENERIC =
  /^(beatification|beatifications|motu-proprio|letter|enciclica|document|carta|index)$/i;

export function corpusDocIdFor(
  url: string,
  locale: string,
  used: Set<string>,
): string {
  const fn = filenameFromUrl(url);
  let slug = slugFromFilename(fn);
  const date = dateFromFilename(fn);
  if (GENERIC.test(slug) && date) {
    slug = `${slug}-${date}`;
  }
  const loc = (locale || 'es').toLowerCase().split(/[-_]/)[0];
  let id = `${slug}-${loc}`;
  if (used.has(id) && date) {
    id = `${slug}-${date}-${loc}`;
  }
  let n = 2;
  const base = id;
  while (used.has(id)) {
    id = `${slug}-${n}-${loc}`;
    n += 1;
  }
  used.add(id);
  void base;
  return id;
}

export function normalizeVaticanUrl(url: string): string {
  return String(url || '')
    .trim()
    .replace(/^http:\/\//i, 'https://')
    .replace(/\/+$/, '');
}

export function shortTitleFromSlug(slug: string): string {
  const s = slug.replace(/-/g, ' ').trim();
  if (!s) return slug;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
