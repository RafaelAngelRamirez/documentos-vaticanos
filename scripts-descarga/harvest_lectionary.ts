/**
 * Harvest OLM citation tables (not biblical text) from Felix Just HTML.
 *
 * Source: catholic-resources.org/Lectionary/ (1998/2002 USA edition of the
 * Ordo Lectionum Missae, 1981). We pack verse references only; the bible pack
 * supplies the body.
 *
 *   npx ts-node --transpile-only harvest_lectionary.ts --from-dir /tmp/lectionary-src
 */
import * as fs from 'fs';
import * as path from 'path';

type Abc = 'A' | 'B' | 'C';
type OlmCites = {
  first?: string;
  psalm?: string;
  second?: string;
  gospel?: string;
};

const ROOT = path.resolve(__dirname, '..');
const OUT_JSON = path.join(
  ROOT,
  'frontend/src/app/core/liturgia/olm-pack.json',
);
const OUT_TS = path.join(
  ROOT,
  'frontend/src/app/core/liturgia/olm-pack.ts',
);

const BOOKS: [string, string][] = [
  ['1 Chronicles', '1Cro'],
  ['2 Chronicles', '2Cro'],
  ['1 Chron', '1Cro'],
  ['2 Chron', '2Cro'],
  ['1 Samuel', '1S'],
  ['2 Samuel', '2S'],
  ['1 Kings', '1R'],
  ['2 Kings', '2R'],
  ['1 Maccabees', '1M'],
  ['2 Maccabees', '2M'],
  ['1 Macc', '1M'],
  ['2 Macc', '2M'],
  ['1 Corinthians', '1Co'],
  ['2 Corinthians', '2Co'],
  ['1 Cor', '1Co'],
  ['2 Cor', '2Co'],
  ['1 Thessalonians', '1Ts'],
  ['2 Thessalonians', '2Ts'],
  ['1 Thess', '1Ts'],
  ['2 Thess', '2Ts'],
  ['1 Timothy', '1Tm'],
  ['2 Timothy', '2Tm'],
  ['1 Tim', '1Tm'],
  ['2 Tim', '2Tm'],
  ['1 Peter', '1P'],
  ['2 Peter', '2P'],
  ['1 Pet', '1P'],
  ['2 Pet', '2P'],
  ['1 John', '1Jn'],
  ['2 John', '2Jn'],
  ['3 John', '3Jn'],
  ['1 Jn', '1Jn'],
  ['2 Jn', '2Jn'],
  ['3 Jn', '3Jn'],
  ['Song of Songs', 'Ct'],
  ['Song of Solomon', 'Ct'],
  ['Canticle', 'Ct'],
  ['Ecclesiasticus', 'Si'],
  ['Ecclesiastes', 'Qo'],
  ['Lamentations', 'Lm'],
  ['Revelation', 'Ap'],
  ['Philippians', 'Flp'],
  ['Colossians', 'Col'],
  ['Philemon', 'Flm'],
  ['Phlm', 'Flm'],
  ['Hebrews', 'Hb'],
  ['Heb', 'Hb'],
  ['James', 'St'],
  ['Jas', 'St'],
  ['Jude', 'Judas'],
  ['Titus', 'Tt'],
  ['Galatians', 'Ga'],
  ['Gal', 'Ga'],
  ['Ephesians', 'Ef'],
  ['Eph', 'Ef'],
  ['Romans', 'Rm'],
  ['Rom', 'Rm'],
  ['Acts', 'Hch'],
  ['Matthew', 'Mt'],
  ['Matt', 'Mt'],
  ['Mark', 'Mc'],
  ['Luke', 'Lc'],
  ['John', 'Jn'],
  ['Genesis', 'Gn'],
  ['Gen', 'Gn'],
  ['Exodus', 'Ex'],
  ['Exod', 'Ex'],
  ['Leviticus', 'Lv'],
  ['Lev', 'Lv'],
  ['Numbers', 'Nm'],
  ['Num', 'Nm'],
  ['Deuteronomy', 'Dt'],
  ['Deut', 'Dt'],
  ['Joshua', 'Jos'],
  ['Josh', 'Jos'],
  ['Judges', 'Jc'],
  ['Judg', 'Jc'],
  ['Ruth', 'Rt'],
  ['Ezra', 'Esd'],
  ['Nehemiah', 'Ne'],
  ['Neh', 'Ne'],
  ['Tobit', 'Tb'],
  ['Tob', 'Tb'],
  ['Judith', 'Jdt'],
  ['Esther', 'Est'],
  ['Esth', 'Est'],
  ['Job', 'Jb'],
  ['Psalms', 'Sal'],
  ['Psalm', 'Sal'],
  ['Ps', 'Sal'],
  ['Proverbs', 'Pr'],
  ['Prov', 'Pr'],
  ['Wisdom', 'Sb'],
  ['Wis', 'Sb'],
  ['Sirach', 'Si'],
  ['Sir', 'Si'],
  ['Isaiah', 'Is'],
  ['Isa', 'Is'],
  ['Jeremiah', 'Jr'],
  ['Jer', 'Jr'],
  ['Baruch', 'Ba'],
  ['Bar', 'Ba'],
  ['Ezekiel', 'Ez'],
  ['Ezek', 'Ez'],
  ['Daniel', 'Dn'],
  ['Dan', 'Dn'],
  ['Hosea', 'Os'],
  ['Hos', 'Os'],
  ['Joel', 'Jl'],
  ['Amos', 'Am'],
  ['Obadiah', 'Ab'],
  ['Obad', 'Ab'],
  ['Jonah', 'Jon'],
  ['Micah', 'Mi'],
  ['Mic', 'Mi'],
  ['Nahum', 'Na'],
  ['Nah', 'Na'],
  ['Habakkuk', 'Ha'],
  ['Hab', 'Ha'],
  ['Zephaniah', 'So'],
  ['Zeph', 'So'],
  ['Haggai', 'Ag'],
  ['Hag', 'Ag'],
  ['Zechariah', 'Za'],
  ['Zech', 'Za'],
  ['Malachi', 'Ml'],
  ['Mal', 'Ml'],
  ['Qoheleth', 'Qo'],
  ['Rev', 'Ap'],
  ['Apoc', 'Ap'],
  ['Mt', 'Mt'],
  ['Mk', 'Mc'],
  ['Lk', 'Lc'],
  ['Jn', 'Jn'],
];

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function decodeHtml(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '–')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
    .replace(/&#8224;|&dagger;/gi, '')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function stripTags(html: string): string {
  return decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function cellsOfRow(trHtml: string): string[] {
  const out: string[] = [];
  const re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trHtml))) out.push(stripTags(m[1]));
  return out;
}

function rowsOfHtml(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const cells = cellsOfRow(m[1]);
    if (cells.length >= 4) rows.push(cells);
  }
  return rows;
}

function isHeaderRow(cells: string[]): boolean {
  const blob = cells.join(' ').toLowerCase();
  return (
    /\bfirst reading\b/.test(blob) &&
    (/\bgospel\b/.test(blob) || /\bresponsorial\b/.test(blob))
  );
}

export function convertCite(raw: string): string {
  let s = decodeHtml(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[—―]/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || /^[.\-–]+$/.test(s)) return '';
  if (/no bibl/i.test(s) && s.length < 40) return '';
  if (/^see the sunday/i.test(s)) return '';
  s = s.replace(/^[ABC]\s*:\s*/, '');
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.split(/\s+or[,.]?\s+/i)[0].trim();
  s = s.replace(/\s+[–-]\s+[A-ZÁÉÍÓÚ][A-Za-zÁÉÍÓÚáéíóú].*$/, '');
  s = s.replace(/[()[\]]/g, ' ');
  s = s.replace(/\bdagger\b/gi, '');
  s = s.replace(/†/g, '');
  s = s.replace(/\b10-135\b/, '10-13');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';

  let mapped = false;
  for (const [eng, spa] of BOOKS) {
    const re = new RegExp(
      `^${eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?\\s+`,
      'i',
    );
    if (re.test(s)) {
      s = s.replace(re, `${spa} `);
      mapped = true;
      break;
    }
  }
  if (!mapped) {
    for (const [eng, spa] of BOOKS) {
      const re = new RegExp(
        `(?:^|\\s)(${eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\.?\\s+(?=\\d)`,
        'i',
      );
      if (re.test(s)) {
        s = s.replace(re, ` ${spa} `).trim();
        break;
      }
    }
  }
  s = s.replace(/(\d+):(\d+)/g, '$1,$2');
  s = s.replace(/,(\s+)(?=\d)/g, '.');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function citesFromCells(
  first: string,
  psalm: string,
  gospel: string,
  second?: string,
): OlmCites | null {
  const out: OlmCites = {};
  let firstRaw = first;
  let secondRaw = second || '';
  if (!secondRaw && /\sand\s+/i.test(firstRaw)) {
    const parts = firstRaw.split(/\s+and\s+/i);
    firstRaw = parts[0];
    secondRaw = parts.slice(1).join(' ');
  }
  const f = convertCite(firstRaw);
  const p = convertCite(psalm);
  const g = convertCite(gospel);
  const s = secondRaw ? convertCite(secondRaw) : '';
  if (f) out.first = f;
  if (p) out.psalm = p;
  if (s) out.second = s;
  if (g) out.gospel = g;
  if (!out.gospel && !out.first) return null;
  return out;
}

function weekdayIndex(label: string): number | null {
  const m = label.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|thurs|tues|thur|mon|tue|wed|thu|fri|sat)\b/i,
  );
  if (!m) return null;
  const k = m[1].toLowerCase().slice(0, 3);
  const map: Record<string, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
  };
  return map[k] ?? null;
}

function abcOf(label: string): Abc | null {
  if (/\bABC\b/.test(label)) return null;
  const m = label.match(/(?:^|[\s\-–])([ABC])(?:\b|$)/);
  return m ? (m[1] as Abc) : null;
}

function nth(label: string, word: string): number | null {
  const m = label.match(
    new RegExp(`(\\d+)\\s*(?:st|nd|rd|th)?\\s+${word}`, 'i'),
  );
  return m ? Number(m[1]) : null;
}

function ensureGrid(grid: OlmCites[][], week: number, dow: number, row: OlmCites) {
  const wi = week - 1;
  if (wi < 0 || dow < 0) return;
  while (grid.length <= wi) grid.push([]);
  const line = grid[wi];
  while (line.length <= dow) line.push({});
  line[dow] = row;
}

function ensureSunday(
  map: Record<string, Record<Abc, OlmCites>>,
  week: number,
  cycle: Abc,
  row: OlmCites,
) {
  const k = String(week);
  if (!map[k]) map[k] = {} as Record<Abc, OlmCites>;
  map[k][cycle] = row;
}

function readHtml(dir: string, name: string): string {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) throw new Error(`missing ${p}`);
  return fs.readFileSync(p, 'latin1');
}

function classifyWeekday(day: string): { kind: string; week?: number; dow?: number; dateKey?: string } | null {
  const d = day.replace(/\s+/g, ' ').trim();
  if (/chrism mass/i.test(d)) return null;
  if (/optional mass/i.test(d)) return null;
  if (/ash wednesday/i.test(d)) return { kind: 'ash', dow: 2 };
  if (/after ash/i.test(d)) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'ash', dow };
  }
  if (/holy week/i.test(d)) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'lent', week: 6, dow };
  }
  if (/octave of easter/i.test(d)) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'easter', week: 1, dow };
  }
  let week = nth(d, 'week of advent');
  if (week) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'advent', week, dow };
  }
  week = nth(d, 'week of lent');
  if (week) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'lent', week, dow };
  }
  week = nth(d, 'week of easter');
  if (week) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'easter', week, dow };
  }
  const dec = d.match(/dec(?:ember|\.)\s*(\d+)/i);
  if (dec) {
    const n = Number(dec[1]);
    if (n >= 17 && n <= 24) return { kind: 'dec17', dateKey: String(n) };
    if (n >= 26 && n <= 31) {
      return { kind: 'xmasDay', dateKey: `12-${String(n).padStart(2, '0')}` };
    }
  }
  if (/after epiphany/i.test(d)) {
    const dow = weekdayIndex(d);
    return dow == null ? null : { kind: 'afterEpiphany', dow };
  }
  const jan = d.match(/jan(?:uary|\.)\s*(\d+)/i);
  if (jan) {
    const n = Number(jan[1]);
    if (n >= 2 && n <= 12) {
      return { kind: 'xmasDay', dateKey: `01-${String(n).padStart(2, '0')}` };
    }
  }
  return null;
}

function classifySunday(day: string): { kind: string; week?: number; cycle?: Abc; feast?: string } | null {
  const d = day.replace(/\s+/g, ' ').trim();
  const cycle = abcOf(d);
  if (/baptism of the lord/i.test(d)) {
    return { kind: 'feast', feast: 'baptism', cycle: cycle || 'A' };
  }
  if (/holy family/i.test(d)) {
    return { kind: 'feast', feast: 'holy-family', cycle: cycle || 'A' };
  }
  if (/mother of god/i.test(d) || /mary, mother/i.test(d)) {
    return { kind: 'feast', feast: 'mary-mother', cycle: 'A' };
  }
  if (/\bepiphany\b/i.test(d)) {
    return { kind: 'feast', feast: 'epiphany', cycle: cycle || 'A' };
  }
  if (/mass during the night/i.test(d) || /christmas: mass during the night/i.test(d)) {
    return { kind: 'feast', feast: 'christmas', cycle: 'A' };
  }
  if (/\bpalm\b/i.test(d) && /\bsunday\b/i.test(d)) {
    return { kind: 'feast', feast: 'palm-sunday', cycle: cycle || 'A' };
  }
  if (/holy thursday/i.test(d)) return { kind: 'feast', feast: 'holy-thursday' };
  if (/good friday/i.test(d)) return { kind: 'feast', feast: 'good-friday' };
  if (/ascension/i.test(d)) {
    return { kind: 'feast', feast: 'ascension', cycle: cycle || 'A' };
  }
  if (/easter vigil/i.test(d)) return null;
  if (/easter sunday/i.test(d) && /resurrection/i.test(d)) {
    return { kind: 'feast', feast: 'easter', cycle: cycle || 'A' };
  }
  if (/sacred heart/i.test(d)) {
    return { kind: 'feast', feast: 'sacred-heart', cycle: cycle || 'A' };
  }
  if (/trinity/i.test(d)) {
    return { kind: 'feast', feast: 'trinity', cycle: cycle || 'A' };
  }
  if (/corpus christi|body & blood|body and blood/i.test(d)) {
    return { kind: 'feast', feast: 'corpus-christi', cycle: cycle || 'A' };
  }
  if (/pentecost sunday/i.test(d)) {
    if (/vigil/i.test(d)) return null;
    return { kind: 'feast', feast: 'pentecost', cycle: cycle || 'A' };
  }
  if (/christ the king/i.test(d) || /last sunday in ordinary/i.test(d)) {
    return { kind: 'feast', feast: 'christ-the-king', cycle: cycle || 'A' };
  }
  let week = nth(d, 'sunday of advent');
  if (week && cycle) return { kind: 'adventSunday', week, cycle };
  week = nth(d, 'sunday of lent');
  if (week && cycle) return { kind: 'lentSunday', week, cycle };
  week = nth(d, 'sunday of easter');
  if (week && cycle) return { kind: 'easterSunday', week, cycle };
  week = nth(d, 'sunday in ordinary');
  if (week && cycle) return { kind: 'otSunday', week, cycle };
  week = nth(d, 'sunday of ordinary');
  if (week && cycle) return { kind: 'otSunday', week, cycle };
  return null;
}

function looksLikeCite(s: string): boolean {
  return /\d+\s*:\s*\d+/.test(s) || /\b(Gen|Exod|Isa|Matt|Mark|Luke|John|Acts|Ps|1 John)\b/i.test(s);
}

function looksLikeDay(s: string): boolean {
  return /\b(week|sunday|monday|tuesday|wednesday|thursday|friday|saturday|december|january|jan\.?|dec\.?|ash|octave|epiphany|christmas|lent|advent|holy|nativity|solemnity|feast|memorial)\b/i.test(
    s,
  );
}

function weekdayTriple(cells: string[]): { day: string; first: string; psalm: string; gospel: string } | null {
  const gospel = cells[cells.length - 1] || '';
  let dayIdx = -1;
  for (let i = 0; i < Math.min(4, cells.length - 3); i++) {
    if (looksLikeDay(cells[i]) && !looksLikeCite(cells[i])) {
      dayIdx = i;
      break;
    }
  }
  if (dayIdx < 0) return null;
  return {
    day: cells[dayIdx],
    first: cells[dayIdx + 1] || '',
    psalm: cells[dayIdx + 2] || '',
    gospel,
  };
}

function sundayQuad(cells: string[]): {
  day: string;
  first: string;
  psalm: string;
  second: string;
  gospel: string;
} | null {
  if (cells.length >= 8) {
    return {
      day: cells[2],
      first: cells[3],
      psalm: cells[4],
      second: cells[5],
      gospel: cells[7],
    };
  }
  return null;
}

function main() {
  const dir = argValue('--from-dir') || '/tmp/lectionary-src';
  const unclassified: string[] = [];

  const adventWeekday: OlmCites[][] = [];
  const lentWeekday: OlmCites[][] = [];
  const easterWeekday: OlmCites[][] = [];
  const ash: Record<string, OlmCites> = {};
  const dec17: Record<string, OlmCites> = {};
  const christmasDays: Record<string, OlmCites> = {};
  const afterEpiphany: OlmCites[] = [];
  const adventSunday: Record<string, Record<Abc, OlmCites>> = {};
  const lentSunday: Record<string, Record<Abc, OlmCites>> = {};
  const easterSunday: Record<string, Record<Abc, OlmCites>> = {};
  const otSunday: Record<string, Record<Abc, OlmCites>> = {};
  const feasts: Record<string, OlmCites | Record<Abc, OlmCites>> = {};

  const CYCLED = new Set([
    'trinity',
    'corpus-christi',
    'sacred-heart',
    'palm-sunday',
    'easter',
    'pentecost',
    'christ-the-king',
    'holy-family',
    'baptism',
    'ascension',
  ]);

  function putFeast(id: string, cycle: Abc | undefined, row: OlmCites) {
    if (!CYCLED.has(id) && !cycle) {
      feasts[id] = row;
      return;
    }
    const prev = feasts[id];
    const cur: Record<Abc, OlmCites> =
      prev && typeof prev === 'object' && ('A' in prev || 'B' in prev || 'C' in prev)
        ? { ...(prev as Record<Abc, OlmCites>) }
        : ({} as Record<Abc, OlmCites>);
    if (cycle) cur[cycle] = row;
    else {
      cur.A = row;
      cur.B = row;
      cur.C = row;
    }
    feasts[id] = cur;
  }

  function ingestWeekdayFile(name: string) {
    const html = readHtml(dir, name);
    for (const cells of rowsOfHtml(html)) {
      if (isHeaderRow(cells)) continue;
      const trip = weekdayTriple(cells);
      if (!trip) continue;
      const cls = classifyWeekday(trip.day);
      const row = citesFromCells(trip.first, trip.psalm, trip.gospel);
      if (!row) continue;
      if (!cls) {
        if (/optional mass|chrism mass|see the sunday/i.test(trip.day)) continue;
        unclassified.push(`WD ${name}: ${trip.day}`);
        continue;
      }
      if (cls.kind === 'advent' && cls.week && cls.dow != null) {
        ensureGrid(adventWeekday, cls.week, cls.dow, row);
      } else if (cls.kind === 'lent' && cls.week && cls.dow != null) {
        ensureGrid(lentWeekday, cls.week, cls.dow, row);
      } else if (cls.kind === 'easter' && cls.week && cls.dow != null) {
        ensureGrid(easterWeekday, cls.week, cls.dow, row);
      } else if (cls.kind === 'ash' && cls.dow != null) {
        ash[String(cls.dow)] = row;
      } else if (cls.kind === 'dec17' && cls.dateKey) {
        dec17[cls.dateKey] = row;
      } else if (cls.kind === 'xmasDay' && cls.dateKey) {
        christmasDays[cls.dateKey] = row;
      } else if (cls.kind === 'afterEpiphany' && cls.dow != null) {
        while (afterEpiphany.length <= cls.dow) afterEpiphany.push({});
        afterEpiphany[cls.dow] = row;
      }
    }
  }

  function ingestSundayFile(name: string) {
    const html = readHtml(dir, name);
    for (const cells of rowsOfHtml(html)) {
      if (isHeaderRow(cells)) continue;
      const quad = sundayQuad(cells);
      if (!quad) continue;
      const cls = classifySunday(quad.day);
      if (/^\s*opt\b/i.test(quad.gospel)) continue;
      const row = citesFromCells(quad.first, quad.psalm, quad.gospel, quad.second);
      if (!row) continue;
      if (!cls) {
        if (/vigil mass|mass at dawn|mass during the day/i.test(quad.day)) continue;
        if (quad.day.length < 4) continue;
        unclassified.push(`SUN ${name}: ${quad.day.slice(0, 80)}`);
        continue;
      }
      if (cls.kind === 'feast' && cls.feast) {
        putFeast(cls.feast, cls.cycle, row);
      } else if (cls.kind === 'adventSunday' && cls.week && cls.cycle) {
        ensureSunday(adventSunday, cls.week, cls.cycle, row);
      } else if (cls.kind === 'lentSunday' && cls.week && cls.cycle) {
        ensureSunday(lentSunday, cls.week, cls.cycle, row);
      } else if (cls.kind === 'easterSunday' && cls.week && cls.cycle) {
        ensureSunday(easterSunday, cls.week, cls.cycle, row);
      } else if (cls.kind === 'otSunday' && cls.week && cls.cycle) {
        ensureSunday(otSunday, cls.week, cls.cycle, row);
      }
    }
  }

  ingestWeekdayFile('Weekdays-AdventChristmas.htm');
  ingestWeekdayFile('Weekdays-Lent.htm');
  ingestWeekdayFile('Weekdays-Easter.htm');
  ingestSundayFile('Advent.htm');
  ingestSundayFile('Christmas.htm');
  ingestSundayFile('Lent.htm');
  ingestSundayFile('Easter.htm');
  ingestSundayFile('OrdinaryA.htm');
  ingestSundayFile('OrdinaryB.htm');
  ingestSundayFile('OrdinaryC.htm');
  ingestSundayFile('Solemnities.htm');

  for (const id of Object.keys(feasts)) {
    const row = feasts[id];
    if (!row || typeof row !== 'object') continue;
    if ('gospel' in (row as OlmCites) && (row as OlmCites).gospel) {
      const one = row as OlmCites;
      feasts[id] = { A: one, B: one, C: one };
      continue;
    }
    const cyc = row as Record<Abc, OlmCites>;
    const proto = cyc.A || cyc.B || cyc.C;
    if (proto) {
      if (!cyc.A) cyc.A = proto;
      if (!cyc.B) cyc.B = proto;
      if (!cyc.C) cyc.C = proto;
    }
  }

  const pack = {
    source:
      'Ordo Lectionum Missae (1981). Citation tables compiled after Felix Just, S.J., https://catholic-resources.org/Lectionary/ (1998/2002 USA edition). Verse references only; body text is not included.',
    harvestedAt: new Date().toISOString(),
    adventWeekday,
    lentWeekday,
    easterWeekday,
    ash,
    dec17,
    christmasDays,
    afterEpiphany,
    adventSunday,
    lentSunday,
    easterSunday,
    otSunday,
    feasts,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  const ts =
    '/* generated by harvest_lectionary.ts — citations only, not biblical text */\n' +
    'export const OLM_PACK = ' +
    JSON.stringify(pack) +
    ';\nexport default OLM_PACK;\n';
  fs.writeFileSync(OUT_TS, ts, 'utf8');

  const counts = {
    adventWd: adventWeekday.flat().filter((x) => x.gospel).length,
    lentWd: lentWeekday.flat().filter((x) => x.gospel).length,
    easterWd: easterWeekday.flat().filter((x) => x.gospel).length,
    ash: Object.keys(ash).length,
    dec17: Object.keys(dec17).length,
    xmas: Object.keys(christmasDays).length,
    afterEpi: afterEpiphany.filter((x) => x.gospel).length,
    adventSun: Object.values(adventSunday).reduce((n, c) => n + Object.keys(c).length, 0),
    lentSun: Object.values(lentSunday).reduce((n, c) => n + Object.keys(c).length, 0),
    easterSun: Object.values(easterSunday).reduce((n, c) => n + Object.keys(c).length, 0),
    otSun: Object.values(otSunday).reduce((n, c) => n + Object.keys(c).length, 0),
    feasts: Object.keys(feasts).length,
    unclassified: unclassified.length,
  };
  console.log(JSON.stringify(counts, null, 2));
  if (unclassified.length) {
    console.log('unclassified sample:');
    for (const u of unclassified.slice(0, 40)) console.log(' -', u);
  }
}

const invokedDirectly = /\bharvest_lectionary\.ts$/.test(
  String(process.argv[1] || '').replace(/\\/g, '/'),
);
if (invokedDirectly) {
  main();
}
