/**
 * Parse the official vatican.va pontiff table (ES).
 * Source: https://www.vatican.va/content/vatican/es/holy-father.html
 * Pure (no network).
 */

const ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\u0027',
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
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellText(td: string): string {
  const decoded = decodeHtmlEntities(stripTags(td));
  return decoded.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface VaticanPopeRow {
  ordinal: number;
  name: string;
  href: string;
  sourceUrl: string;
  vaticanSlug: string;
  contentSlug?: string;
  id: string;
  reignStart: string;
  reignEnd: string;
  secularName: string;
  birthplace: string;
  century: number;
}

/** Exact vatican.va path basenames → stable Spanish ids. */
const SLUG_EXACT: Record<string, string> = {
  'san-pietro': 'pedro',
  'papa-lino': 'lino',
  'anacleto-o-cleto': 'anacleto',
  clemente: 'clemente-i',
  'milziade-o-melchiade': 'melquiades',
  'deusdedit-o-adeodato-i': 'adeodato-i',
  'gregorio-i--magno': 'gregorio-i',
  'leone-i--magno': 'leon-i',
  'niccolo-il-grande': 'nicolas-i',
  'stefano-ii--iii': 'esteban-ii',
  'stefano-iii--iv': 'esteban-iii',
  'stefano-iv--v': 'esteban-iv',
  'stefano-v--vi': 'esteban-v',
  'stefano-vi--vii': 'esteban-vi',
  'stefano-vii--viii': 'esteban-vii',
  'stefano-viii--ix': 'esteban-viii',
  'stefano-ix--x': 'esteban-ix',
  'paolo-i0': 'pablo-i',
  'giovanni-viii0': 'juan-viii',
  'giovanni-xi0': 'juan-xi',
  'benedetto-ix-1': 'benedicto-ix',
  'benedetto-ix-2': 'benedicto-ix-2',
  'benedetto-ix-3': 'benedicto-ix-3',
  francesco: 'francisco',
  'leone-xiv': 'leon-xiv',
  'leo-xiv': 'leon-xiv',
  'benedetto-xvi': 'benedicto-xvi',
  'giovanni-paolo-i': 'juan-pablo-i',
  'giovanni-paolo-ii': 'juan-pablo-ii',
  zosimo: 'zosimo',
  'anastasio-ii': 'anastasio-ii',
};

/** Latin content-hub slugs used by some medieval popes. */
const LATIN_HUB: Record<string, string> = {
  'gregorius-ix': 'gregorio-ix',
  'innocentius-iv': 'inocencio-iv',
  'urbanus-iv': 'urbano-iv',
  'benedictus-xii': 'benedicto-xii',
  'clemens-vi': 'clemente-vi',
  'eugenius-iv': 'eugenio-iv',
  'pius-ix': 'pio-ix',
  'pius-x': 'pio-x',
  'pius-xi': 'pio-xi',
  'pius-xii': 'pio-xii',
  'leo-xiii': 'leon-xiii',
  'john-paul-i': 'juan-pablo-i',
  'john-paul-ii': 'juan-pablo-ii',
  'john-xxiii': 'juan-xxiii',
  'paul-vi': 'pablo-vi',
  'benedict-xvi': 'benedicto-xvi',
};

const IT_TO_ES: Array<[RegExp, string]> = [
  [/giovanni-paolo/g, 'juan-pablo'],
  [/giovanni/g, 'juan'],
  [/francesco/g, 'francisco'],
  [/benedetto/g, 'benedicto'],
  [/leone/g, 'leon'],
  [/paolo/g, 'pablo'],
  [/innocenzo/g, 'inocencio'],
  [/alessandro/g, 'alejandro'],
  [/vittore/g, 'victor'],
  [/callisto/g, 'calixto'],
  [/sisto/g, 'sixto'],
  [/stefano/g, 'esteban'],
  [/niccolo/g, 'nicolas'],
  [/giulio/g, 'julio'],
  [/pasquale/g, 'pascual'],
  [/onorio/g, 'honorio'],
  [/felice/g, 'felix'],
  [/marcello/g, 'marcelo'],
  [/silvestro/g, 'silvestre'],
  [/igino/g, 'higinio'],
  [/zefirino/g, 'ceferino'],
  [/fabiano/g, 'fabian'],
  [/ponziano/g, 'ponciano'],
  [/ormisda/g, 'hormisdas'],
  [/agatone/g, 'agaton'],
  [/zaccaria/g, 'zacarias'],
  [/sisinnio/g, 'sisinio'],
  [/costantino/g, 'constantino'],
  [/martino/g, 'martin'],
  [/conone/g, 'conon'],
  [/landone/g, 'landon'],
  [/valentino/g, 'valentin'],
  [/eutichiano/g, 'eutiquiano'],
  [/^ilario$/, 'hilario'],
  [/marcellino/g, 'marcelino'],
  [/^caio$/, 'cayo'],
  [/simmaco/g, 'simaco'],
  [/gregorius/g, 'gregorio'],
  [/innocentius/g, 'inocencio'],
  [/urbanus/g, 'urbano'],
  [/benedictus/g, 'benedicto'],
  [/clemens/g, 'clemente'],
  [/eugenius/g, 'eugenio'],
];

/**
 * Map a vatican.va path basename (or content hub slug) to the pack id.
 */
export function slugToPopeId(raw: string): string {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.html?$/i, '');
  if (!base) return '';
  if (SLUG_EXACT[base]) return SLUG_EXACT[base];
  if (LATIN_HUB[base]) return LATIN_HUB[base];
  let s = base.replace(/--+/g, '-');
  for (const [re, to] of IT_TO_ES) {
    s = s.replace(re, to);
  }
  return s.replace(/^-|-$/g, '');
}

export function extractVaticanSlug(href: string): {
  vaticanSlug: string;
  contentSlug?: string;
} {
  const h = String(href || '').trim();
  const holy = h.match(/\/holy-father\/([^/?#]+)/i);
  const content = h.match(/\/content\/([^/]+)\//i);
  const hub =
    content && content[1] && content[1].toLowerCase() !== 'vatican'
      ? content[1].toLowerCase()
      : undefined;
  const file = (holy?.[1] || hub || h.split('/').filter(Boolean).pop() || '')
    .replace(/\.html?$/i, '')
    .toLowerCase();
  return { vaticanSlug: file, contentSlug: hub };
}

export function absoluteVaticanUrl(href: string): string {
  const h = String(href || '').trim();
  if (!h) return '';
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('/')) return `https://www.vatican.va${h}`;
  return `https://www.vatican.va/${h}`;
}

/**
 * Century → era bucket for the 2C list (chronological, not alphabetical).
 */
export function eraForCentury(century: number): { era: string; eraLabel: string } {
  const c = Number(century) || 0;
  if (c <= 3) {
    return {
      era: 'Siglos I–III · Iglesia antigua',
      eraLabel: `Siglo ${roman(c) || c}`,
    };
  }
  if (c <= 7) {
    return {
      era: 'Siglos IV–VII · Antigüedad tardía',
      eraLabel: `Siglo ${roman(c) || c}`,
    };
  }
  if (c <= 10) {
    return {
      era: 'Siglos VIII–X · Alta Edad Media',
      eraLabel: `Siglo ${roman(c) || c}`,
    };
  }
  if (c <= 13) {
    return {
      era: 'Siglos XI–XIII · Plena Edad Media',
      eraLabel: `Siglo ${roman(c) || c}`,
    };
  }
  if (c <= 15) {
    return {
      era: 'Siglos XIV–XV · Baja Edad Media',
      eraLabel: `Siglo ${roman(c) || c}`,
    };
  }
  if (c <= 18) {
    return {
      era: 'Siglos XVI–XVIII · Edad moderna',
      eraLabel: `Siglo ${roman(c) || c}`,
    };
  }
  return {
    era: 'Siglos XIX–XXI · Edad contemporánea',
    eraLabel: `Siglo ${roman(c) || c}`,
  };
}

function roman(n: number): string {
  const map: Record<number, string> = {
    1: 'I',
    2: 'II',
    3: 'III',
    4: 'IV',
    5: 'V',
    6: 'VI',
    7: 'VII',
    8: 'VIII',
    9: 'IX',
    10: 'X',
    11: 'XI',
    12: 'XII',
    13: 'XIII',
    14: 'XIV',
    15: 'XV',
    16: 'XVI',
    17: 'XVII',
    18: 'XVIII',
    19: 'XIX',
    20: 'XX',
    21: 'XXI',
  };
  return map[n] || String(n);
}

/** Aviñón popes in the official numbering (Clemente V – Gregorio XI). */
export function seeForOrdinal(ordinal: number): string {
  if (ordinal >= 195 && ordinal <= 201) return 'Aviñón';
  return 'Roma';
}

/**
 * Parse table#holy-father from the Holy See pontiff index.
 */
export function parseHolyFatherHtml(html: string): VaticanPopeRow[] {
  const start = html.search(/id=["']holy-father["']/i);
  if (start < 0) {
    throw new Error('holy-father table not found');
  }
  const table = html.slice(start);
  const end = table.search(/<\/table>/i);
  const body = end >= 0 ? table.slice(0, end) : table;
  const rows = Array.from(body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  const out: VaticanPopeRow[] = [];
  for (const m of rows) {
    const row = m[1];
    if (/<th\b/i.test(row)) continue;
    const tds = Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)).map(
      (x) => x[1],
    );
    if (tds.length < 7) continue;
    const ordinal = parseInt(cellText(tds[0]), 10);
    if (!Number.isFinite(ordinal) || ordinal < 1) continue;
    const nameTd = tds[1];
    const hrefMatch = nameTd.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1].trim() : '';
    const name =
      cellText(nameTd)
        .replace(/,\s*martire$/i, '')
        .trim() || `Papa ${ordinal}`;
    const { vaticanSlug, contentSlug } = extractVaticanSlug(href);
    const id = slugToPopeId(vaticanSlug || contentSlug || name);
    const century = parseInt(cellText(tds[6]), 10) || 0;
    out.push({
      ordinal,
      name,
      href,
      sourceUrl: absoluteVaticanUrl(href),
      vaticanSlug,
      contentSlug,
      id: id || `papa-${ordinal}`,
      reignStart: cellText(tds[2]),
      reignEnd: cellText(tds[3]),
      secularName: cellText(tds[4]),
      birthplace: cellText(tds[5]),
      century,
    });
  }
  return out;
}
