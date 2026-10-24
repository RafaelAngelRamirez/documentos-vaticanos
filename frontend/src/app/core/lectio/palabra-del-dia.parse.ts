/**
 * Parse Vatican News «Palabra del día» RSS (readings + papal commentary).
 * Pure — no DOM / Angular. Defensive: markup may change.
 */

export interface PalabraPassage {
  cite: string;
  text: string;
}

export interface PalabraReflection {
  text: string;
  attribution: string | null;
}

export interface PalabraDelDia {
  dateIso: string | null;
  title: string;
  sourceUrl: string;
  firstReading: PalabraPassage | null;
  gospel: PalabraPassage | null;
  reflection: PalabraReflection | null;
}

const ITEM_RE = /<item\b[\s\S]*?<\/item>/gi;
const TAG_RE = /<[^>]+>/g;

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(TAG_RE, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function innerXml(block: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function cdataOrText(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) return cdata[1];
  return raw;
}

/** YYYY-MM-DD from vaticannews URL …/2026/09/12.html */
export function dateIsoFromPalabraUrl(url: string): string | null {
  const m = String(url || '').match(/\/(\d{4})\/(\d{2})\/(\d{2})\.html/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function paragraphsFromHtml(html: string): string[] {
  const bits = cdataOrText(html).split(/<\/p>/i);
  const out: string[] = [];
  for (const bit of bits) {
    const t = stripTags(bit.replace(/<p\b[^>]*>/gi, ' '));
    if (t) out.push(t);
  }
  return out;
}

function looksLikeCite(p: string): boolean {
  if (!p || p.length > 80) return false;
  return /\d/.test(p) && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(p);
}

function looksLikeGospelHeading(p: string): boolean {
  if (/^lectura del santo evangelio/i.test(p)) return true;
  if (
    /^(gospel of the day|evangelio del d[ií]a|vangelo del giorno|évangile du jour)/i.test(
      p,
    )
  ) {
    return true;
  }
  return p.length < 100 && /^(lectura del )?(santo )?evangelio\b/i.test(p);
}

function looksLikeReadingHeading(p: string): boolean {
  if (looksLikeGospelHeading(p)) return false;
  return /^(primera lectura|segunda lectura|lectura de |reading of the day|first reading|lettura )/i.test(
    p,
  );
}

function looksLikePapal(p: string): boolean {
  return /\b(papa|pope|benedicto|francisco|juan pablo|le[oó]n xiv|homil[ií]a|[áa]ngelus|audiencia general)\b/i.test(
    p,
  );
}

function splitAttribution(text: string): PalabraReflection {
  const m = text.match(/^(.*?)[\s(]+((?:Papa|Pope|San |Saint |Benedicto|Francisco|Juan Pablo|Le[oó]n)[^)]{2,120})\)?\s*$/i);
  if (m && m[1].trim().length > 40) {
    return { text: m[1].trim(), attribution: m[2].replace(/[()]/g, '').trim() };
  }
  const dash = text.match(/^(.*?)\s*\(([^)]{8,120})\)\s*$/);
  if (dash && /papa|pope|homil|ángelus|angelus|audiencia/i.test(dash[2])) {
    return { text: dash[1].trim(), attribution: dash[2].trim() };
  }
  return { text, attribution: null };
}

function passageFrom(paragraphs: string[], headingAt: number): PalabraPassage | null {
  if (headingAt < 0) return null;
  let cite = '';
  let i = headingAt + 1;
  if (paragraphs[i] && looksLikeCite(paragraphs[i])) {
    cite = paragraphs[i];
    i += 1;
  }
  const body: string[] = [];
  for (; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (looksLikeGospelHeading(p) || looksLikePapal(p)) break;
    if (looksLikeReadingHeading(p) && body.length) break;
    body.push(p);
  }
  const text = body.join('\n\n').trim();
  if (!cite && !text) return null;
  return { cite, text };
}

export function parsePalabraItemXml(itemXml: string): PalabraDelDia | null {
  const title = stripTags(cdataOrText(innerXml(itemXml, 'title')));
  const sourceUrl = stripTags(
    innerXml(itemXml, 'guid') || innerXml(itemXml, 'link'),
  );
  if (!title && !sourceUrl) return null;
  const desc = innerXml(itemXml, 'description');
  const ps = paragraphsFromHtml(desc);

  let gospelAt = -1;
  let readingAt = -1;
  let papalAt = -1;
  for (let i = 0; i < ps.length; i++) {
    if (gospelAt < 0 && looksLikeGospelHeading(ps[i])) gospelAt = i;
    if (readingAt < 0 && looksLikeReadingHeading(ps[i])) readingAt = i;
    if (papalAt < 0 && looksLikePapal(ps[i]) && gospelAt >= 0 && i > gospelAt) {
      papalAt = i;
    }
  }
  if (papalAt < 0 && gospelAt >= 0 && ps.length > gospelAt + 2) {
    papalAt = ps.length - 1;
  }

  const gospel = passageFrom(ps, gospelAt);
  const firstReading =
    readingAt >= 0 && (gospelAt < 0 || readingAt < gospelAt)
      ? passageFrom(ps, readingAt)
      : null;

  let reflection: PalabraReflection | null = null;
  if (papalAt >= 0) {
    const blob = ps.slice(papalAt).join('\n\n').trim();
    if (blob.length > 40) reflection = splitAttribution(blob);
  }

  return {
    dateIso: dateIsoFromPalabraUrl(sourceUrl),
    title,
    sourceUrl,
    firstReading,
    gospel,
    reflection,
  };
}

/**
 * Parse a full RSS document. If `forDateIso` is set, prefer that day's item.
 */
export function parsePalabraDelDiaRss(
  xml: string,
  forDateIso?: string | null,
): PalabraDelDia | null {
  if (!xml || !/<item\b/i.test(xml)) return null;
  const items = xml.match(ITEM_RE) || [];
  const parsed: PalabraDelDia[] = [];
  for (const item of items) {
    const row = parsePalabraItemXml(item);
    if (row) parsed.push(row);
  }
  if (!parsed.length) return null;
  if (forDateIso) {
    const hit = parsed.find((p) => p.dateIso === forDateIso);
    if (hit) return hit;
  }
  return parsed[0];
}

export function palabraRssUrlForLocale(locale: string): string {
  const loc = (locale || 'es').toLowerCase().split(/[-_]/)[0];
  if (loc === 'en') {
    return 'https://www.vaticannews.va/en/word-of-the-day.rss.xml';
  }
  if (loc === 'it') {
    return 'https://www.vaticannews.va/it/vangelo-del-giorno-e-parola-del-giorno.rss.xml';
  }
  if (loc === 'fr') {
    return 'https://www.vaticannews.va/fr/evangile-du-jour.rss.xml';
  }
  if (loc === 'pt') {
    return 'https://www.vaticannews.va/pt/palavra-do-dia.rss.xml';
  }
  return 'https://www.vaticannews.va/es/evangelio-de-hoy.rss.xml';
}
