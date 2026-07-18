/**
 * Build / scrape offline santoral pack.
 *
 * Usage:
 *   npx ts-node --transpile-only import_santoral.ts
 *   npx ts-node --transpile-only import_santoral.ts --offline
 *   npx ts-node --transpile-only import_santoral.ts --scrape --max 40
 *   npx ts-node --transpile-only import_santoral.ts --fixture path.html --source-url URL
 *   npx ts-node --transpile-only import_santoral.ts --holy-see-fixtures
 *
 * Offline default: Padres seed + committed Holy See fixtures (Vatican News + vaticanstate).
 * --scrape: live liturgy/saints + Vatican News day calendar + vaticanstate RSS/items.
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import type { SaintRecord, SantoralManifest } from './models/santoral.model';
import {
  parseSaintBioHtml,
  slugifySaintId,
} from './src/santoral/parse_saint_bio';
import {
  holySeeToSlug,
  parseVaticanNewsSaintsJs,
  parseVaticanStateItemHtml,
  parseVaticanStateRss,
  type ParsedHolySeeSaint,
} from './src/santoral/parse_holy_see_sources';
import { buildPadresSeedSaints } from './src/santoral/seed_padres_saints';
import {
  mergeSaints,
  writeSantoralPack,
} from './src/santoral/write_santoral';

const REPO = path.resolve(__dirname, '..');
const CORPUS_MANIFEST = path.join(REPO, 'documentos', 'corpus', 'manifest.json');
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'santoral');
const SAINTS_INDEX =
  'https://www.vatican.va/news_services/liturgy/saints/index_saints_sp.html';
const BLESSED_INDEX =
  'https://www.vatican.va/news_services/liturgy/saints/index_blessed_sp.html';
const VATICAN_NEWS_BASE = 'https://www.vaticannews.va';
const VATICANSTATE_LIST =
  'https://www.vaticanstate.va/es/estado-y-gobierno/notas-generales/santo-del-dia.html';
const VATICANSTATE_RSS =
  'https://www.vaticanstate.va/es/estado-y-gobierno/notas-generales/santo-del-dia.feed?type=rss';

const SOURCE_NOTE =
  'Santoral offline: Padres/autores del corpus + biografías de vatican.va/news_services/liturgy/saints (ES) + Santo del día de Vatican News (vaticannews.va/es/santos) y vaticanstate.va (notas/RSS). No inventa vidas; no incluye el Martirologio Romano completo (libro impreso).';

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function loadCorpusDocs(): { id: string; title?: string; author?: string }[] {
  if (!fs.existsSync(CORPUS_MANIFEST)) return [];
  const m = JSON.parse(fs.readFileSync(CORPUS_MANIFEST, 'utf-8'));
  return (m.documents || []).map(
    (d: { id: string; title?: string; author?: string }) => ({
      id: d.id,
      title: d.title,
      author: d.author,
    }),
  );
}

function extractSpBioLinks(html: string, pageUrl: string): string[] {
  const hrefs = Array.from(
    html.matchAll(/href=["']([^"']+)["']/gi),
    (m) => m[1],
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hrefs) {
    if (!/_sp\.html?/i.test(h)) continue;
    if (/_photo_/i.test(h) || /photo\.html/i.test(h)) continue;
    if (!/ns_lit_doc_/i.test(h)) continue;
    let abs: string;
    if (/^https?:/i.test(h)) abs = h;
    else if (h.startsWith('/')) abs = `https://www.vatican.va${h}`;
    else {
      const baseDir = pageUrl.replace(/[^/]+$/, '');
      abs = new URL(h, baseDir).href;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'DocumentosVaticanos-Santoral/1.0' },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const buf = Buffer.from(res.data);
  const ct = String(res.headers['content-type'] || '');
  if (/utf-8/i.test(ct) || /json|javascript|xml/i.test(ct)) {
    return buf.toString('utf8');
  }
  // vatican.va liturgy pages are typically iso-8859-1
  if (/vatican\.va\/news_services\/liturgy/i.test(url)) {
    return buf.toString('latin1');
  }
  return buf.toString('utf8');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function saintFromLiturgyParsed(
  parsed: ReturnType<typeof parseSaintBioHtml>,
  id?: string,
): SaintRecord | null {
  if (!parsed.name || !parsed.bio || parsed.bio.length < 40) return null;
  const sid = id || slugifySaintId(parsed.name, parsed.sourceUrl);
  return {
    id: sid,
    name: parsed.name.replace(/^(San|Santa|Santo|Beato|Beata)\s+/i, '').trim(),
    displayName: parsed.name.match(/^(San|Santa|Beato|Beata)\b/i)
      ? parsed.name
      : undefined,
    years: parsed.years,
    bio: parsed.bio,
    sourceUrl: parsed.sourceUrl,
    locale: parsed.locale || 'es',
    era: 'Canonizaciones · Santa Sede',
    eraLabel: 'Santo / Beato (biografía vaticana)',
    meta: [parsed.years, 'vatican.va'].filter(Boolean).join(' · '),
    authorAliases: [parsed.name],
    documentIds: [],
  };
}

function saintFromHolySee(p: ParsedHolySeeSaint): SaintRecord | null {
  if (!p.name || !p.bio || p.bio.length < 20) return null;
  const id = holySeeToSlug(p);
  const host =
    p.origin === 'vaticannews' ? 'vaticannews.va' : 'vaticanstate.va';
  return {
    id,
    name: p.name,
    displayName: p.displayName,
    role: p.role,
    bio: p.bio,
    sourceUrl: p.sourceUrl,
    locale: p.locale || 'es',
    feastDays: p.feastDays,
    era: 'Santoral · Santa Sede',
    eraLabel:
      p.origin === 'vaticannews'
        ? 'Santo del día (Vatican News)'
        : 'Santo del día (Estado de la Ciudad del Vaticano)',
    meta: [...(p.feastDays || []), host].filter(Boolean).join(' · '),
    authorAliases: [p.displayName || p.name, p.name].filter(
      (v, i, a) => v && a.indexOf(v) === i,
    ),
    documentIds: [],
  };
}

function uniqueById(saints: SaintRecord[]): SaintRecord[] {
  const used = new Set<string>();
  const out: SaintRecord[] = [];
  for (const s of saints) {
    let id = s.id;
    let n = 2;
    while (used.has(id)) id = `${s.id}-${n++}`;
    used.add(id);
    out.push(id === s.id ? s : { ...s, id });
  }
  return out;
}

/**
 * Fold accidental `slug-2` / `slug-3` rows (from prior uniqueById) into base slug.
 */
function collapseNumericIdSuffixes(saints: SaintRecord[]): SaintRecord[] {
  const base: SaintRecord[] = [];
  const extras: SaintRecord[] = [];
  for (const s of saints) {
    const m = s.id.match(/^(.*)-(\d+)$/);
    if (m && Number(m[2]) >= 2 && Number(m[2]) < 100) {
      extras.push({ ...s, id: m[1] });
    } else {
      base.push(s);
    }
  }
  if (!extras.length) return saints;
  return mergeSaints(base, extras);
}

async function scrapeLiturgySaints(max: number): Promise<SaintRecord[]> {
  const indices = [SAINTS_INDEX, BLESSED_INDEX];
  const links: string[] = [];
  for (const idx of indices) {
    try {
      const html = await fetchText(idx);
      links.push(...extractSpBioLinks(html, idx));
    } catch (e) {
      console.warn(`index fetch failed ${idx}:`, (e as Error).message);
    }
  }
  console.log(`Found ${links.length} Spanish bio links; scraping up to ${max}`);
  const saints: SaintRecord[] = [];
  for (const url of links) {
    if (saints.length >= max) break;
    try {
      const html = await fetchText(url);
      const parsed = parseSaintBioHtml(html, url);
      const s = saintFromLiturgyParsed(parsed);
      if (!s) continue;
      saints.push(s);
      process.stdout.write(`.`);
      await sleep(80);
    } catch {
      process.stdout.write(`x`);
    }
  }
  process.stdout.write('\n');
  return uniqueById(saints);
}

/**
 * Harvest Vatican News day calendar for a month range (default: full year MM 01–12, DD 01–31).
 * Bounded by `max` saints. Uses `.saints.js` JSON endpoints.
 */
async function scrapeVaticanNewsDays(max: number): Promise<SaintRecord[]> {
  const out: ParsedHolySeeSaint[] = [];
  // Prefer covering the year; stop when max reached
  outer: for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 31; day++) {
      if (out.length >= max) break outer;
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dayPath = `/es/santos/${mm}/${dd}.saints.js`;
      const url = `${VATICAN_NEWS_BASE}${dayPath}`;
      try {
        const text = await fetchText(url);
        const batch = parseVaticanNewsSaintsJs(text, dayPath, VATICAN_NEWS_BASE);
        out.push(...batch);
        process.stdout.write(batch.length ? '.' : '-');
      } catch {
        process.stdout.write('x');
      }
      await sleep(60);
    }
  }
  process.stdout.write('\n');
  console.log(`Vatican News days: ${out.length} raw saint rows`);
  return uniqueById(
    out.map(saintFromHolySee).filter((s): s is SaintRecord => !!s),
  );
}

/**
 * Harvest vaticanstate RSS (+ optional item pages for longer bios, up to maxItems).
 */
async function scrapeVaticanState(maxItems: number): Promise<SaintRecord[]> {
  let rssXml = '';
  try {
    rssXml = await fetchText(VATICANSTATE_RSS);
  } catch (e) {
    console.warn('vaticanstate RSS failed:', (e as Error).message);
    return [];
  }
  const fromRss = parseVaticanStateRss(rssXml);
  console.log(`vaticanstate RSS items: ${fromRss.length}`);
  const limited = fromRss.slice(0, maxItems);
  const enriched: ParsedHolySeeSaint[] = [];
  for (const row of limited) {
    try {
      const html = await fetchText(row.sourceUrl);
      const full = parseVaticanStateItemHtml(html, row.sourceUrl);
      enriched.push(full && full.bio.length >= row.bio.length ? full : row);
      process.stdout.write(full ? '.' : 'r');
      await sleep(100);
    } catch {
      enriched.push(row);
      process.stdout.write('x');
    }
  }
  process.stdout.write('\n');
  return uniqueById(
    enriched.map(saintFromHolySee).filter((s): s is SaintRecord => !!s),
  );
}

function parseLiturgyFixture(file: string, sourceUrl: string): SaintRecord | null {
  const html = fs.readFileSync(file);
  let text = html.toString('utf8');
  if (/charset=iso-8859-1/i.test(text) && !text.includes('á') && !text.includes('í')) {
    text = html.toString('latin1');
  }
  const parsed = parseSaintBioHtml(text, sourceUrl);
  return saintFromLiturgyParsed(parsed);
}

/**
 * Load committed Holy See fixtures (no network).
 * Same slug from News + vaticanstate is merged (longer bio wins).
 */
export function loadHolySeeFixtures(dir = FIXTURES_DIR): SaintRecord[] {
  let saints: SaintRecord[] = [];
  const vnJs = path.join(dir, 'vn_07_18.saints.js');
  if (fs.existsSync(vnJs)) {
    const text = fs.readFileSync(vnJs, 'utf8');
    const rows = parseVaticanNewsSaintsJs(
      text,
      '/es/santos/07/18.saints.js',
      VATICAN_NEWS_BASE,
    );
    const batch = rows
      .map(saintFromHolySee)
      .filter((s): s is SaintRecord => !!s);
    saints = mergeSaints(saints, batch);
  }
  const rss = path.join(dir, 'vaticanstate_santo.rss.xml');
  if (fs.existsSync(rss)) {
    const rows = parseVaticanStateRss(fs.readFileSync(rss, 'utf8'));
    const batch = rows
      .map(saintFromHolySee)
      .filter((s): s is SaintRecord => !!s);
    saints = mergeSaints(saints, batch);
  }
  const item = path.join(dir, 'vaticanstate_bruno_segni.html');
  if (fs.existsSync(item)) {
    const url =
      'https://www.vaticanstate.va/es/estado-y-gobierno/notas-generales/santo-del-dia/2287-18-de-julio-san-bruno-de-segni-obispo.html';
    const row = parseVaticanStateItemHtml(fs.readFileSync(item, 'utf8'), url);
    if (row) {
      const s = saintFromHolySee(row);
      if (s) saints = mergeSaints(saints, [s]);
    }
  }
  return saints;
}

async function main(): Promise<void> {
  const doScrape = argFlag('--scrape');
  const fixture = argValue('--fixture');
  const holySeeFixtures =
    argFlag('--holy-see-fixtures') ||
    argFlag('--offline') ||
    (!doScrape && !fixture);
  const sourceUrl =
    argValue('--source-url') ||
    'https://www.vatican.va/news_services/liturgy/saints/ns_lit_doc_fixture_sp.html';
  const max = Number(argValue('--max') || '50');
  // Cap day calendar separately so one year is feasible when max is large
  const maxDays = Number(argValue('--max-days') || String(Math.min(max, 400)));
  const maxState = Number(argValue('--max-state') || String(Math.min(max, 40)));

  const docs = loadCorpusDocs();
  let saints = buildPadresSeedSaints(docs);
  console.log(`Seed padres/authors: ${saints.length} (corpus docs ${docs.length})`);

  // Preserve any existing liturgy/scraped bios already dual-written
  const existingPath = path.join(
    REPO,
    'documentos',
    'corpus',
    'santoral',
    'manifest.json',
  );
  if (fs.existsSync(existingPath) && !argFlag('--no-merge-existing')) {
    try {
      const prev = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
      if (Array.isArray(prev.saints) && prev.saints.length) {
        saints = mergeSaints(saints, prev.saints as SaintRecord[]);
        console.log(`Merged existing pack: ${prev.saints.length} → ${saints.length}`);
      }
    } catch {
      /* ignore corrupt pack */
    }
  }

  if (fixture) {
    const s = parseLiturgyFixture(path.resolve(fixture), sourceUrl);
    if (s) {
      saints = mergeSaints(saints, [s]);
      console.log(`Fixture saint: ${s.id} bioLen=${s.bio?.length}`);
    } else {
      console.warn('Fixture parse produced empty saint');
    }
  }

  if (holySeeFixtures && !doScrape) {
    const hs = loadHolySeeFixtures();
    saints = mergeSaints(saints, hs);
    console.log(
      `Holy See fixtures: ${hs.length} (e.g. ${hs
        .slice(0, 3)
        .map((s) => s.id)
        .join(', ')})`,
    );
  }

  if (doScrape) {
    try {
      const liturgy = await scrapeLiturgySaints(max);
      saints = mergeSaints(saints, liturgy);
      console.log(`Liturgy scraped: ${liturgy.length}`);
    } catch (e) {
      console.warn('Liturgy scrape failed:', (e as Error).message);
    }
    try {
      const vn = await scrapeVaticanNewsDays(maxDays);
      saints = mergeSaints(saints, vn);
      console.log(`Vatican News scraped: ${vn.length}`);
    } catch (e) {
      console.warn('Vatican News scrape failed:', (e as Error).message);
    }
    try {
      const vs = await scrapeVaticanState(maxState);
      saints = mergeSaints(saints, vs);
      console.log(`vaticanstate scraped: ${vs.length}`);
    } catch (e) {
      console.warn('vaticanstate scrape failed:', (e as Error).message);
    }
    // Always fold fixtures so CI/offline-capable saints remain if live truncates
    const hs = loadHolySeeFixtures();
    saints = mergeSaints(saints, hs);
  }

  saints = collapseNumericIdSuffixes(saints);

  // Ensure Agustín has confesiones among documentIds
  const ag = saints.find((s) => s.id === 'agustin-hipona');
  if (ag) {
    const agDocs = docs.filter(
      (d) =>
        d.id.startsWith('agustin-') ||
        (d.author && /agust[ií]n/i.test(d.author)),
    );
    ag.documentIds = Array.from(
      new Set([...(ag.documentIds || []), ...agDocs.map((d) => d.id)]),
    ).sort();
    console.log(
      `Agustín documentIds: ${ag.documentIds.length} (has confesiones=${ag.documentIds.includes('agustin-02-confesiones-es')})`,
    );
  }

  const manifest: SantoralManifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceNote: SOURCE_NOTE,
    saints,
  };

  const result = writeSantoralPack(manifest);
  console.log(
    `Wrote santoral pack: ${result.saintCount} saints → ${result.roots.join(', ')}`,
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
