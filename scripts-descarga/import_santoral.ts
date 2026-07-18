/**
 * Build / scrape offline santoral pack.
 *
 * Usage:
 *   npx ts-node --transpile-only import_santoral.ts
 *   npx ts-node --transpile-only import_santoral.ts --scrape --max 40
 *   npx ts-node --transpile-only import_santoral.ts --offline   # seed only
 *   npx ts-node --transpile-only import_santoral.ts --fixture path.html --source-url URL
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import type { SaintRecord, SantoralManifest } from './models/santoral.model';
import {
  parseSaintBioHtml,
  slugifySaintId,
} from './src/santoral/parse_saint_bio';
import { buildPadresSeedSaints } from './src/santoral/seed_padres_saints';
import {
  mergeSaints,
  writeSantoralPack,
} from './src/santoral/write_santoral';

const REPO = path.resolve(__dirname, '..');
const CORPUS_MANIFEST = path.join(REPO, 'documentos', 'corpus', 'manifest.json');
const SAINTS_INDEX =
  'https://www.vatican.va/news_services/liturgy/saints/index_saints_sp.html';
const BLESSED_INDEX =
  'https://www.vatican.va/news_services/liturgy/saints/index_blessed_sp.html';
const BASE = 'https://www.vatican.va/news_services/liturgy/saints/';

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
      // resolve relative to page directory
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
  // vatican.va saints pages are typically iso-8859-1
  const ct = String(res.headers['content-type'] || '');
  if (/utf-8/i.test(ct)) return buf.toString('utf8');
  return buf.toString('latin1');
}

function saintFromParsed(
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

async function scrapeSaints(max: number): Promise<SaintRecord[]> {
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
  const usedIds = new Set<string>();
  for (const url of links) {
    if (saints.length >= max) break;
    try {
      const html = await fetchText(url);
      const parsed = parseSaintBioHtml(html, url);
      let s = saintFromParsed(parsed);
      if (!s) continue;
      // unique id
      let id = s.id;
      let n = 2;
      while (usedIds.has(id)) {
        id = `${s.id}-${n++}`;
      }
      s = { ...s, id };
      usedIds.add(id);
      saints.push(s);
      process.stdout.write(`.`);
    } catch {
      process.stdout.write(`x`);
    }
  }
  process.stdout.write('\n');
  return saints;
}

function parseFixture(file: string, sourceUrl: string): SaintRecord | null {
  let html = fs.readFileSync(file);
  // prefer utf-8 if valid; else latin1
  let text: string;
  try {
    text = html.toString('utf8');
    if (text.includes('\uFFFD') && /charset=iso-8859-1/i.test(text)) {
      text = html.toString('latin1');
    }
  } catch {
    text = html.toString('latin1');
  }
  // if file is already utf-8 re-encoded (our fixtures)
  if (!/charset=iso-8859-1/i.test(text) || text.includes('á') || text.includes('í')) {
    // keep
  } else {
    text = html.toString('latin1');
  }
  const parsed = parseSaintBioHtml(text, sourceUrl);
  return saintFromParsed(parsed);
}

async function main(): Promise<void> {
  const offline = argFlag('--offline') || (!argFlag('--scrape') && !argFlag('--fixture'));
  const doScrape = argFlag('--scrape');
  const fixture = argValue('--fixture');
  const sourceUrl =
    argValue('--source-url') ||
    'https://www.vatican.va/news_services/liturgy/saints/ns_lit_doc_fixture_sp.html';
  const max = Number(argValue('--max') || '50');

  const docs = loadCorpusDocs();
  let saints = buildPadresSeedSaints(docs);
  console.log(`Seed padres/authors: ${saints.length} (corpus docs ${docs.length})`);

  if (fixture) {
    const s = parseFixture(path.resolve(fixture), sourceUrl);
    if (s) {
      saints = mergeSaints(saints, [s]);
      console.log(`Fixture saint: ${s.id} bioLen=${s.bio?.length}`);
    } else {
      console.warn('Fixture parse produced empty saint');
    }
  }

  if (doScrape) {
    try {
      const scraped = await scrapeSaints(max);
      saints = mergeSaints(saints, scraped);
      console.log(`Scraped saints: ${scraped.length}`);
    } catch (e) {
      console.warn('Live scrape failed:', (e as Error).message);
    }
  } else if (offline) {
    console.log('Offline mode: seed pack only (use --scrape for vatican.va harvest)');
  }

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
    sourceNote:
      'Santoral offline: Padres/autores del corpus + biografías de vatican.va/news_services/liturgy/saints (ES cuando existe). No inventa vidas ausentes en la Santa Sede.',
    saints,
  };

  const result = writeSantoralPack(manifest);
  console.log(
    `Wrote santoral pack: ${result.saintCount} saints → ${result.roots.join(', ')}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
