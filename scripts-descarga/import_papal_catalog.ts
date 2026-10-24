/**
 * Import vatican.va papal documents from the papacy catalog into the corpus.
 *
 * Does NOT edit sources.json / doc-codes.json (other agents own those).
 * Skips packs that already exist (id or sourceUrl). Dual-writes corpus roots.
 *
 *   npx ts-node --transpile-only import_papal_catalog.ts
 *   npx ts-node --transpile-only import_papal_catalog.ts --locales es,en,ar,zh
 *   npx ts-node --transpile-only import_papal_catalog.ts --concurrency 8 --limit 20
 */
import fs from 'fs';
import path from 'path';
const { parseHTML } = require('linkedom');
import { fetchHtml } from './src/crawl/fetcher';
import { parseVaticanProseParagraphs } from './src/adapters/vatican_prose.adapter';
import { parseNumberedParagraphs } from './src/adapters/generic_numbered.adapter';
import { writeCorpusDocument } from './src/pipeline/write_corpus';
import type { SourceConfig } from './src/adapters/types';
import type { TrasnportData } from './models/transport_data.model';
import type { PopeRecord } from './models/papacy.model';
import {
  corpusDocIdFor,
  filenameFromUrl,
  normalizeVaticanUrl,
  shortTitleFromSlug,
  slugFromFilename,
} from './src/papacy/slug';

const REPO = path.resolve(__dirname, '..');
const CATALOG = path.join(
  REPO,
  'documentos/papacy-source/inventory/apostolic-letters.json',
);
const PAPACY_PACK = path.join(REPO, 'documentos/corpus/papacy/manifest.json');
const CORPUS_MANIFEST = path.join(REPO, 'documentos/corpus/manifest.json');
const REPORT = path.join(
  REPO,
  'documentos/papacy-source/inventory/import-report.json',
);
const CACHE = path.join(REPO, 'documentos/papacy-source/raw/docs-cache');

const MAGISTERIAL = new Set([
  'apostolic-letter',
  'encyclical',
  'apostolic-exhortation',
  'apostolic-constitution',
  'motu-proprio',
]);

const GENRE_NOTE: Record<string, string> = {
  'apostolic-letter': 'Carta apostólica',
  encyclical: 'Encíclica',
  'apostolic-exhortation': 'Exhortación apostólica',
  'apostolic-constitution': 'Constitución apostólica',
  'motu-proprio': 'Motu proprio',
};

const PRODUCT_LOCALE: Record<string, string> = {
  es: 'es',
  en: 'en',
  ar: 'ar',
  zh: 'zh',
  zh_cn: 'zh',
  hi: 'hi',
};

function argValue(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const pref = `${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  if (hit) return hit.slice(pref.length);
  return fallback;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function decodeTitle(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromHtml(html: string, fallback: string): string {
  const { document } = parseHTML(html);
  const h1 = document.querySelector('h1');
  const h1t = decodeTitle((h1?.textContent || '').replace(/\s+/g, ' '));
  if (h1t && h1t.length > 8 && !/^la santa sede$/i.test(h1t)) return h1t;
  const tit = document.querySelector('title');
  let t = decodeTitle((tit?.textContent || '').replace(/\s+/g, ' '));
  t = t.replace(/\s*\|\s*.*$/, '').replace(/\s*-\s*La Santa Sede.*$/i, '').trim();
  if (t && t.length > 8) return t;
  const em = document.querySelector('.documento em, .testo em, em');
  const emt = decodeTitle((em?.textContent || '').replace(/\s+/g, ' '));
  if (emt && emt.length > 2 && emt.length < 80) return emt;
  return fallback;
}

function pickUnits(html: string): TrasnportData[] {
  const numbered = parseNumberedParagraphs(html);
  const prose = parseVaticanProseParagraphs(html);
  const n = numbered.units || [];
  const p = (prose.units || []).filter(
    (u) => (u.contenido || '').trim().length >= 20,
  );
  if (n.length >= 8) return n;
  if (p.length >= n.length && p.length >= 2) return p;
  if (n.length >= 2) return n;
  if (p.length >= 1) return p;
  return n.length ? n : p;
}

function textLen(units: TrasnportData[]): number {
  return units.reduce((acc, u) => acc + (u.contenido || '').length, 0);
}

function loadExisting(): {
  ids: Set<string>;
  urls: Set<string>;
} {
  const ids = new Set<string>();
  const urls = new Set<string>();
  if (!fs.existsSync(CORPUS_MANIFEST)) return { ids, urls };
  const m = JSON.parse(fs.readFileSync(CORPUS_MANIFEST, 'utf-8'));
  for (const d of m.documents || []) {
    if (d.id) ids.add(d.id);
    if (d.sourceUrl) urls.add(normalizeVaticanUrl(d.sourceUrl));
  }
  return { ids, urls };
}

function loadPopes(): Map<string, PopeRecord> {
  const map = new Map<string, PopeRecord>();
  if (!fs.existsSync(PAPACY_PACK)) return map;
  const m = JSON.parse(fs.readFileSync(PAPACY_PACK, 'utf-8'));
  for (const p of m.popes || []) map.set(p.id, p);
  return map;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.max(1, concurrency);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

type CatalogRow = {
  popeId: string;
  title: string;
  sourceUrl: string;
  genre?: string;
  locale?: string;
  date?: string;
};

function catalogRows(locales: Set<string>): CatalogRow[] {
  const raw = JSON.parse(fs.readFileSync(CATALOG, 'utf-8'));
  const docs: CatalogRow[] = Array.isArray(raw) ? raw : raw.documents || [];
  const out: CatalogRow[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    const locRaw = (d.locale || '').toLowerCase();
    const loc = PRODUCT_LOCALE[locRaw];
    if (!loc || !locales.has(loc)) continue;
    if (!MAGISTERIAL.has(d.genre || '')) continue;
    const url = normalizeVaticanUrl(d.sourceUrl || '');
    if (!url || /\.index\.html$/i.test(url)) continue;
    if (!/\/documents\//i.test(url)) continue;
    const key = `${loc}::${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      popeId: d.popeId,
      title: d.title,
      sourceUrl: url,
      genre: d.genre,
      locale: loc,
      date: d.date,
    });
  }
  return out;
}

async function main(): Promise<void> {
  const locales = new Set(
    (argValue('--locales', 'es,en,ar,zh') || 'es')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const concurrency = Math.max(1, parseInt(argValue('--concurrency', '8') || '8', 10));
  const limit = parseInt(argValue('--limit', '0') || '0', 10) || 0;
  const dry = argFlag('--dry-run');

  const { ids, urls } = loadExisting();
  const popes = loadPopes();
  let rows = catalogRows(locales).filter((r) => !urls.has(r.sourceUrl));
  if (limit > 0) rows = rows.slice(0, limit);

  console.log(
    `[papal-import] pending ${rows.length} (locales=${[...locales].join(',')}) concurrency=${concurrency}${dry ? ' dry-run' : ''}`,
  );
  if (!rows.length) {
    console.log('[papal-import] nothing to do');
    return;
  }

  fs.mkdirSync(CACHE, { recursive: true });
  const usedIds = new Set(ids);
  const report: Array<Record<string, unknown>> = [];
  let ok = 0;
  let skip = 0;
  let fail = 0;
  let writeChain = Promise.resolve();
  const withWriteLock = <T>(fn: () => T): Promise<T> => {
    const run = writeChain.then(() => fn());
    writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  await mapPool(rows, concurrency, async (row, idx) => {
    const loc = row.locale || 'es';
    const id = corpusDocIdFor(row.sourceUrl, loc, usedIds);
    if (ids.has(id)) {
      skip += 1;
      report.push({ id, url: row.sourceUrl, status: 'exists-id' });
      return;
    }
    try {
      const page = await fetchHtml(row.sourceUrl, { cacheRoot: CACHE });
      if (page.httpStatus >= 400 || !page.html || page.html.length < 800) {
        fail += 1;
        report.push({
          id,
          url: row.sourceUrl,
          status: 'http',
          httpStatus: page.httpStatus,
        });
        return;
      }
      const units = pickUnits(page.html);
      const chars = textLen(units);
      if (units.length < 1 || (units.length === 1 && chars < 400) || chars < 250) {
        skip += 1;
        report.push({
          id,
          url: row.sourceUrl,
          status: 'thin',
          units: units.length,
          chars,
        });
        return;
      }
      const slug = slugFromFilename(filenameFromUrl(row.sourceUrl));
      const title = titleFromHtml(
        page.html,
        row.title && row.title.length > 12 ? row.title : shortTitleFromSlug(slug),
      );
      const pope = popes.get(row.popeId);
      const author = pope?.displayName || pope?.name || row.popeId;
      const genreLabel = GENRE_NOTE[row.genre || ''] || 'Documento papal';
      const config: SourceConfig = {
        id: id.replace(/-(es|en|ar|zh|hi)$/, ''),
        title,
        shortTitle: shortTitleFromSlug(slug).slice(0, 48),
        kind: 'magisterium',
        locale: loc,
        corpusDocId: id,
        adapter: units.length >= 8 ? 'generic_numbered' : 'vatican_prose',
        seedUrls: [row.sourceUrl],
        author,
        sourceNote: `${genreLabel} oficial de vatican.va (${loc}). ${author}.`,
        translationProvenance: 'official',
        notes: `papacy-catalog ${row.genre} ${row.popeId}`,
      };
      if (dry) {
        ok += 1;
        report.push({ id, url: row.sourceUrl, status: 'dry', units: units.length, title });
        return;
      }
      await withWriteLock(() => {
        writeCorpusDocument(config, units);
        ids.add(id);
        urls.add(row.sourceUrl);
      });
      ok += 1;
      report.push({
        id,
        url: row.sourceUrl,
        status: 'ok',
        units: units.length,
        chars,
        title,
        popeId: row.popeId,
        locale: loc,
        genre: row.genre,
      });
      if ((idx + 1) % 15 === 0) {
        console.log(
          `[papal-import] ${idx + 1}/${rows.length} ok=${ok} skip=${skip} fail=${fail}`,
        );
      }
    } catch (err) {
      fail += 1;
      report.push({
        id,
        url: row.sourceUrl,
        status: 'error',
        error: (err as Error).message,
      });
    }
  });

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(
    REPORT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        locales: [...locales],
        pending: rows.length,
        ok,
        skip,
        fail,
        documents: report,
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );
  console.log(`[papal-import] done ok=${ok} skip=${skip} fail=${fail} report=${REPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
