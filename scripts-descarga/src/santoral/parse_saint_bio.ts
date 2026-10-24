/**
 * Parse vatican.va liturgy/saints biography HTML into pack fields.
 * Pure (no network). Handles iso-8859-1 entities common on Holy See pages.
 */

export interface ParsedSaintBio {
  /** Display name derived from <title> / meta title (entity-decoded). */
  name: string;
  /** Years string when present in title, e.g. "1809-1882". */
  years?: string;
  /** Plain-text biography body (non-empty when page has content). */
  bio: string;
  sourceUrl: string;
  locale?: string;
  /** Raw title string after entity decode. */
  title: string;
}

const ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  uuml: 'ü',
  Uuml: 'Ü',
  iquest: '¿',
  iexcl: '¡',
  laquo: '«',
  raquo: '»',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  deg: '°',
};

export function decodeHtmlEntities(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
    const code = parseInt(h, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
  s = s.replace(/&([a-zA-Z]+);/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(ENTITY_MAP, name)
      ? ENTITY_MAP[name]
      : m,
  );
  return s;
}

function stripTags(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<\/div>/gi, '\n');
  s = s.replace(/<\/tr>/gi, '\n');
  s = s.replace(/<\/h[1-6]>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, ' ');
  return s;
}

function collapseWs(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Extract title from <title> or meta name="title".
 */
export function extractSaintTitle(html: string): string {
  const meta = html.match(
    /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i,
  );
  if (meta?.[1]) return decodeHtmlEntities(meta[1]).trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) return decodeHtmlEntities(title[1]).trim();
  return '';
}

/**
 * Prefer Spanish locale from meta language or URL suffix _sp.
 */
export function detectLocale(html: string, sourceUrl: string): string | undefined {
  const meta = html.match(
    /<meta\s+name=["']language["']\s+content=["']([^"']+)["']/i,
  );
  if (meta?.[1]) {
    const lang = meta[1].toLowerCase();
    if (lang.startsWith('es') || lang === 'sp') return 'es';
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('it')) return 'it';
    return lang.slice(0, 2);
  }
  if (/_sp\.html?/i.test(sourceUrl)) return 'es';
  if (/_en\.html?/i.test(sourceUrl)) return 'en';
  if (/_it\.html?/i.test(sourceUrl)) return 'it';
  return undefined;
}

/**
 * Pull a human name from a vatican.va bio title.
 * Examples:
 *  "Paula Frassinetti (1809-1882) - biografía" → name + years
 *  "José Olallo Valdés (1820-1889), Biografía" → …
 */
export function splitNameAndYears(title: string): {
  name: string;
  years?: string;
} {
  let t = title.trim();
  t = t.replace(/\s*[-–—,]\s*biograf[ií]a\.?$/i, '');
  t = t.replace(/\s*biograf[ií]a\.?$/i, '');
  t = t.trim();
  const m = t.match(/^(.*?)\s*\((\d{3,4}\s*[-–—]\s*\d{3,4})\)\s*$/);
  if (m) {
    return { name: m[1].trim(), years: m[2].replace(/\s+/g, '') };
  }
  const m2 = t.match(/^(.*?)\s*\((\d{3,4}\s*[-–—]\s*\d{3,4})\)/);
  if (m2) {
    return { name: m2[1].trim(), years: m2[2].replace(/\s+/g, '') };
  }
  return { name: t };
}

/**
 * Collect text of <p>…</p> blocks (main body of classic vatican.va saint pages).
 * INIZIO/FINE markers on many liturgy pages wrap only a short header, so
 * paragraph extraction is the reliable path.
 */
export function extractParagraphs(html: string): string[] {
  const out: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = collapseWs(decodeHtmlEntities(stripTags(m[1])));
    if (!raw) continue;
    // Drop pure chrome / single-word labels
    if (/^(foto|photo|imagen|image|back|up|search)$/i.test(raw)) continue;
    if (raw.length < 12 && !/[.!?…]/.test(raw)) continue;
    out.push(raw);
  }
  return out;
}

/**
 * Body text from saint bio HTML. Prefers concatenated <p> blocks; falls back
 * to full stripped body after INIZIO when paragraphs are scarce.
 */
export function extractBioBody(html: string): string {
  const paragraphs = extractParagraphs(html);
  if (paragraphs.length >= 2) {
    return paragraphs.join('\n\n');
  }
  if (paragraphs.length === 1 && paragraphs[0].length >= 80) {
    return paragraphs[0];
  }

  let chunk = html;
  const inizio = html.search(/<!--\s*INIZIO\s+TESTO\s*-->/i);
  const fine = html.search(/<!--\s*FINE\s+TESTO\s*-->/i);
  // When markers sandwich almost nothing, use content AFTER FINE instead
  if (inizio >= 0 && fine > inizio && fine - inizio < 200) {
    chunk = html.slice(fine);
  } else if (inizio >= 0) {
    chunk =
      fine > inizio ? html.slice(inizio, fine) : html.slice(inizio);
  }

  let text = collapseWs(decodeHtmlEntities(stripTags(chunk)));
  const noise = [
    /^the holy see\s*/i,
    /^la santa sede\s*/i,
    /^search\s*/i,
    /^back\s*/i,
    /^up\s*/i,
  ];
  for (const re of noise) {
    text = text.replace(re, '');
  }
  text = text
    .replace(/function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g, ' ')
    .replace(/document\.write\([^)]*\)/gi, ' ')
    .replace(/var\s+\w+\s*=\s*[^;]+;/gi, ' ');
  text = collapseWs(text);
  return text;
}

/**
 * Parse a full HTML page into saint bio fields. Always sets sourceUrl.
 */
export function parseSaintBioHtml(
  html: string,
  sourceUrl: string,
): ParsedSaintBio {
  if (!html || /404 Resource/i.test(html)) {
    return {
      name: '',
      bio: '',
      sourceUrl,
      title: '',
    };
  }
  const title = extractSaintTitle(html);
  const { name, years } = splitNameAndYears(title || '');
  const bio = extractBioBody(html);
  const locale = detectLocale(html, sourceUrl);
  return {
    name: name || title,
    years,
    bio,
    sourceUrl,
    locale,
    title,
  };
}

/**
 * Stable slug id from name or filename.
 * "Paula Frassinetti" → paula-frassinetti
 * ns_lit_doc_19840311_frassinetti_sp.html → frassinetti (fallback)
 */
export function slugifySaintId(name: string, sourceUrl?: string): string {
  let base = normalizeSlug(name);
  if (base.length >= 3) return base.slice(0, 80);
  if (sourceUrl) {
    const file = sourceUrl.split('/').pop() || '';
    const m = file.match(/ns_lit_doc_\d+_(.+?)(?:_photo)?_(?:sp|en|it|fr|po|ge|pl|sl)\.html?/i)
      || file.match(/ns_lit_doc_\d+_(.+?)\.html?/i);
    if (m?.[1]) {
      base = normalizeSlug(m[1].replace(/-/g, ' '));
      if (base) return base.slice(0, 80);
    }
  }
  return base || 'saint-unknown';
}

function normalizeSlug(raw: string): string {
  let s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  s = s.replace(/^(san|santa|santo|beato|beata)\s+/i, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}
