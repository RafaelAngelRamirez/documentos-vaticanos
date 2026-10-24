/**
 * Pure parsers for Holy See ecosystem saint sources (research-named):
 * - Vatican News day calendar JSON (`…/es/santos/MM/DD.saints.js`)
 * - Vatican State “Santo del día” RSS/Atom + item HTML
 *
 * No network I/O. Shared slugify/decode helpers from parse_saint_bio.
 */
import {
  decodeHtmlEntities,
  slugifySaintId,
} from './parse_saint_bio';

export interface ParsedHolySeeSaint {
  name: string;
  /** Full display string when title includes San/Santa/Beato. */
  displayName?: string;
  bio: string;
  sourceUrl: string;
  feastDays?: string[];
  role?: string;
  locale: string;
  /** Origin tag for meta / diagnostics. */
  origin: 'vaticannews' | 'vaticanstate';
}

const MONTHS_ES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

function stripTags(html: string): string {
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<\/div>/gi, '\n');
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

function htmlToPlain(html: string): string {
  return collapseWs(decodeHtmlEntities(stripTags(html || '')));
}

/**
 * Parse Spanish feast date from titles like "18 de julio: San Bruno…"
 * or path segments `07/18`. Returns MM-DD or undefined.
 */
export function parseFeastDayEs(
  titleOrPath: string,
): string | undefined {
  const t = String(titleOrPath || '').trim();
  const pathM = t.match(/(?:^|\/)(\d{2})\/(\d{2})(?:\/|\.|$)/);
  if (pathM) return `${pathM[1]}-${pathM[2]}`;
  const pathM2 = t.match(/(?:^|\/)(\d{1,2})\/(\d{1,2})(?:\/|\.|$)/);
  if (pathM2) {
    const mm = pathM2[1].padStart(2, '0');
    const dd = pathM2[2].padStart(2, '0');
    return `${mm}-${dd}`;
  }
  const es = t.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i,
  );
  if (es) {
    const dd = es[1].padStart(2, '0');
    const mm = MONTHS_ES[es[2].toLowerCase()];
    if (mm) return `${mm}-${dd}`;
  }
  return undefined;
}

/**
 * Normalize display name: expand "s." / "ss." abbreviations used by Vatican News.
 */
export function normalizeSaintDisplayName(raw: string): string {
  let n = decodeHtmlEntities(String(raw || '')).trim();
  n = n.replace(/\s+/g, ' ');
  // s. / S. → San (common Vatican News shorthand)
  n = n.replace(/^ss\.\s+/i, 'Santos ');
  n = n.replace(/^s\.\s+/i, 'San ');
  n = n.replace(/^b\.\s+/i, 'Beato ');
  n = n.replace(/^bb\.\s+/i, 'Beatos ');
  return n.trim();
}

/**
 * Strip honorific for bare `name` field; keep role fragment after comma when useful.
 */
export function splitNameRole(display: string): {
  name: string;
  displayName?: string;
  role?: string;
} {
  let d = display.trim();
  // Drop leading feast date prefix "18 de julio: "
  d = d.replace(
    /^\d{1,2}\s+de\s+\w+\s*:\s*/i,
    '',
  );
  let role: string | undefined;
  const comma = d.match(/^(.*?)(?:,\s+)(.+)$/);
  let core = d;
  if (comma) {
    // Only treat as role if right side looks like office, not a second person list
    const right = comma[2].trim();
    if (
      /^(obispo|mártir|martir|virgen|abad|abadesa|papa|doctor|presbítero|presbitero|diácono|diacono|religioso|religiosa|fundador|fundadora|apóstol|apostol|emperador|emperatriz|confesor|confesora)\b/i.test(
        right,
      ) ||
      right.length < 60
    ) {
      core = comma[1].trim();
      role = right;
    }
  }
  const hasHonorific =
    /^(San|Santa|Santo|Santos|Santas|Beato|Beata|Beatos|Beatas|Bienaventurada|Bienaventurado)\b/i.test(
      core,
    );
  const name = core
    .replace(
      /^(San|Santa|Santo|Santos|Santas|Beato|Beata|Beatos|Beatas|Bienaventurada|Bienaventurado)\s+/i,
      '',
    )
    .trim();
  return {
    name: name || core,
    displayName: hasHonorific ? core : undefined,
    role,
  };
}

function absUrl(href: string, base: string): string {
  if (!href) return base;
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href.startsWith('/')
      ? `https://www.vaticannews.va${href}`
      : href;
  }
}

/**
 * Parse Vatican News day `.saints.js` JSON body.
 * @param jsonText raw response (JSON object with `saints` array)
 * @param dayPath path or URL containing MM/DD, e.g. `/es/santos/07/18.saints.js`
 * @param baseUrl origin for relative links
 */
export function parseVaticanNewsSaintsJs(
  jsonText: string,
  dayPath: string,
  baseUrl = 'https://www.vaticannews.va',
): ParsedHolySeeSaint[] {
  if (!jsonText || !jsonText.trim()) return [];
  if (/404 Resource/i.test(jsonText) || /<html[\s>]/i.test(jsonText)) {
    return [];
  }
  let data: { saints?: unknown[] };
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!data || !Array.isArray(data.saints) || data.saints.length === 0) {
    return [];
  }
  const feast = parseFeastDayEs(dayPath);
  const out: ParsedHolySeeSaint[] = [];
  for (const raw of data.saints) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as {
      name?: string;
      summary?: string;
      link?: string;
    };
    const display = normalizeSaintDisplayName(row.name || '');
    const bio = collapseWs(decodeHtmlEntities(row.summary || ''));
    if (!display || bio.length < 20) continue;
    const { name, displayName, role } = splitNameRole(display);
    if (!name) continue;
    const link = row.link || '';
    // Prefer public /es/santos/… URL over internal /content/vaticannews/…
    let sourceUrl = absUrl(link, baseUrl);
    sourceUrl = sourceUrl.replace(
      /^https?:\/\/www\.vaticannews\.va\/content\/vaticannews\//i,
      'https://www.vaticannews.va/',
    );
    if (!sourceUrl || sourceUrl === baseUrl) {
      sourceUrl = feast
        ? `${baseUrl}/es/santos/${feast.replace('-', '/')}.html`
        : `${baseUrl}/es/santos.html`;
    }
    out.push({
      name,
      displayName: displayName || display,
      bio,
      sourceUrl,
      feastDays: feast ? [feast] : undefined,
      role,
      locale: 'es',
      origin: 'vaticannews',
    });
  }
  return out;
}

/**
 * Parse vaticanstate.va Santo del día RSS 2.0 (item title + description + link).
 */
export function parseVaticanStateRss(
  xml: string,
): ParsedHolySeeSaint[] {
  if (!xml || /404 Resource/i.test(xml) || !/<item[\s>]/i.test(xml)) {
    return [];
  }
  const out: ParsedHolySeeSaint[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = pickXmlField(block, 'title');
    const link = pickXmlField(block, 'link') || pickXmlField(block, 'guid');
    const desc = pickXmlField(block, 'description');
    if (!title || !link) continue;
    const feast = parseFeastDayEs(title);
    const display = normalizeSaintDisplayName(
      title.replace(
        /^\d{1,2}\s+de\s+\w+\s*:\s*/i,
        '',
      ),
    );
    const bio = htmlToPlain(desc || '');
    // RSS often truncates; still accept short elogio if ≥ 40 chars
    if (!display || bio.length < 40) continue;
    const { name, displayName, role } = splitNameRole(display);
    if (!name) continue;
    out.push({
      name,
      displayName: displayName || display,
      bio,
      sourceUrl: link.trim(),
      feastDays: feast ? [feast] : undefined,
      role,
      locale: 'es',
      origin: 'vaticanstate',
    });
  }
  return out;
}

function pickXmlField(block: string, tag: string): string {
  const cdata = block.match(
    new RegExp(`<${tag}\\b[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
  );
  if (cdata?.[1] != null) return cdata[1].trim();
  const plain = block.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  );
  if (plain?.[1] != null) {
    return decodeHtmlEntities(plain[1].replace(/<[^>]+>/g, '').trim());
  }
  return '';
}

/**
 * Parse full vaticanstate item HTML (article.item-page) into one saint record.
 * Prefer this over RSS description for longer elogios.
 */
export function parseVaticanStateItemHtml(
  html: string,
  sourceUrl: string,
): ParsedHolySeeSaint | null {
  if (!html || /404 Resource/i.test(html)) return null;

  let title = '';
  const h1 = html.match(
    /<h1[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i,
  ) || html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) title = htmlToPlain(h1[1]);
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t?.[1]) title = decodeHtmlEntities(t[1]).trim();
  }
  if (!title) return null;

  const feast = parseFeastDayEs(title) || parseFeastDayEs(sourceUrl);
  const display = normalizeSaintDisplayName(
    title.replace(/^\d{1,2}\s+de\s+\w+\s*:\s*/i, ''),
  );
  const { name, displayName, role } = splitNameRole(display);
  if (!name) return null;

  // Prefer article body paragraphs (skip pure image captions if short)
  let article = html;
  const art = html.match(
    /<article\b[^>]*class=["'][^"']*item-page[^"']*["'][^>]*>([\s\S]*?)<\/article>/i,
  ) || html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (art?.[1]) article = art[1];

  const paras: string[] = [];
  const pre = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pre.exec(article)) !== null) {
    const text = htmlToPlain(pm[1]);
    if (!text || text.length < 30) continue;
    // skip share chrome
    if (/^(tweet|compartir|share|facebook)/i.test(text)) continue;
    paras.push(text);
  }
  let bio = paras.join('\n\n');
  if (bio.length < 40) {
    bio = htmlToPlain(article);
  }
  // Drop leading subtitle-only noise (single short line before real bio)
  if (bio.length < 40) return null;

  return {
    name,
    displayName: displayName || display,
    bio,
    sourceUrl,
    feastDays: feast ? [feast] : undefined,
    role,
    locale: 'es',
    origin: 'vaticanstate',
  };
}

/**
 * Map parsed Holy See saint → pack id via shared slugify.
 */
export function holySeeToSlug(parsed: ParsedHolySeeSaint): string {
  return slugifySaintId(parsed.name || parsed.displayName || '', parsed.sourceUrl);
}
