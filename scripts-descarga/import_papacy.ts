/**
 * Build the offline papacy pack from the official vatican.va pontiff table
 * + santoral bios + corpus sourceUrl attribution.
 *
 * Usage:
 *   npx ts-node --transpile-only import_papacy.ts
 *   npx ts-node --transpile-only import_papacy.ts --offline
 *   npx ts-node --transpile-only import_papacy.ts --scrape-indexes
 *
 * Does NOT rewrite corpus document packs (other agents own those files).
 */
import fs from 'fs';
import path from 'path';
import type { PopeRecord, PapacyManifest, PapalWorkRef } from './models/papacy.model';
import type { SaintRecord } from './models/santoral.model';
import {
  parseHolyFatherHtml,
  eraForCentury,
  seeForOrdinal,
} from './src/papacy/parse_holy_father_list';
import { honorFromSaint, matchPopeToSaint } from './src/papacy/match_santoral';
import { linkCorpusToPopes } from './src/papacy/match_corpus';
import {
  compactReign,
  composePopeBio,
  popeInitials,
} from './src/papacy/compose_bio';
import {
  writePapacyDocumentsCatalog,
  writePapacyPack,
} from './src/papacy/write_papacy';
import {
  dedupeCatalog,
  extractYearIndexUrls,
  indexUrlFor,
  PAPAL_ARCHIVE_HUBS,
  PAPAL_INDEX_GENRES,
  parsePapalIndexHtml,
  type CataloguedPapalDoc,
} from './src/papacy/catalog_apostolic_letters';
import { fetchHtml } from './src/crawl/fetcher';

const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures/papacy/holy-father-es.html');
const RAW = path.join(REPO, 'documentos/papacy-source/raw/holy-father-es.html');
const SANTORAL = path.join(REPO, 'documentos/corpus/santoral/manifest.json');
const CORPUS = path.join(REPO, 'documentos/corpus/manifest.json');
const INVENTORY_DIR = path.join(REPO, 'documentos/papacy-source/inventory');
const SOURCE_URL = 'https://www.vatican.va/content/vatican/es/holy-father.html';
const SOURCE_NOTE =
  'Lista oficial de pontífices (vatican.va/content/vatican/es/holy-father.html). Biografías: ficha de reinado de esa tabla + bio del santoral cuando el papa está allí. Documentos: corpus existente (sourceUrl) + catálogo ES de índices vatican.va. No inventa vidas. León XIV = 267º (inicio 8/18.V.2025).';

const PACK_GENRES = new Set([
  'apostolic-letter',
  'encyclical',
  'apostolic-exhortation',
  'apostolic-constitution',
  'motu-proprio',
]);

function isPackCatalogEntry(c: { locale?: string; genre?: string }): boolean {
  const loc = (c.locale || '').toLowerCase();
  if (loc && loc !== 'es') return false;
  return PACK_GENRES.has(c.genre || '');
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function loadHtml(): string {
  if (fs.existsSync(RAW)) return fs.readFileSync(RAW, 'utf-8');
  if (fs.existsSync(FIXTURE)) return fs.readFileSync(FIXTURE, 'utf-8');
  throw new Error(`Missing holy-father HTML at ${RAW} or ${FIXTURE}`);
}

function loadSantoral(): SaintRecord[] {
  if (!fs.existsSync(SANTORAL)) return [];
  const m = JSON.parse(fs.readFileSync(SANTORAL, 'utf-8'));
  return Array.isArray(m.saints) ? m.saints : [];
}

function loadCorpusDocs(): {
  id: string;
  title?: string;
  sourceUrl?: string;
  author?: string;
  locale?: string;
}[] {
  if (!fs.existsSync(CORPUS)) return [];
  const m = JSON.parse(fs.readFileSync(CORPUS, 'utf-8'));
  return (m.documents || []).map(
    (d: {
      id: string;
      title?: string;
      sourceUrl?: string;
      author?: string;
      locale?: string;
    }) => ({
      id: d.id,
      title: d.title,
      sourceUrl: d.sourceUrl,
      author: d.author,
      locale: d.locale,
    }),
  );
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeIndexes(): Promise<CataloguedPapalDoc[]> {
  const cacheRoot = path.join(REPO, 'documentos/papacy-source/raw/indexes-cache');
  ensureDir(cacheRoot);
  const collected: CataloguedPapalDoc[] = [];
  for (const hub of PAPAL_ARCHIVE_HUBS) {
    for (const genre of PAPAL_INDEX_GENRES) {
      const url = indexUrlFor(hub.contentSlug, genre);
      try {
        const page = await fetchHtml(url, { cacheRoot });
        if (page.httpStatus >= 400 || !page.html) {
          console.warn(`[papacy] skip ${url} status=${page.httpStatus}`);
          continue;
        }
        const dest = path.join(
          REPO,
          'documentos/papacy-source/raw/indexes',
          `${hub.contentSlug}-${genre}-es.html`,
        );
        ensureDir(path.dirname(dest));
        fs.writeFileSync(dest, page.html, 'utf-8');
        collected.push(...parsePapalIndexHtml(page.html, url));
        const years = extractYearIndexUrls(page.html, url);
        for (const yurl of years) {
          await sleep(250);
          try {
            const yp = await fetchHtml(yurl, { cacheRoot });
            if (yp.httpStatus >= 400 || !yp.html) continue;
            collected.push(...parsePapalIndexHtml(yp.html, yurl));
          } catch (err) {
            console.warn(`[papacy] year index fail ${yurl}:`, (err as Error).message);
          }
        }
        await sleep(250);
      } catch (err) {
        console.warn(`[papacy] index fail ${url}:`, (err as Error).message);
      }
    }
  }
  return dedupeCatalog(collected);
}

function loadExistingCatalog(): CataloguedPapalDoc[] {
  const p = path.join(INVENTORY_DIR, 'apostolic-letters.json');
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const docs = Array.isArray(raw) ? raw : raw.documents;
    return Array.isArray(docs) ? docs : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const html = loadHtml();
  const rows = parseHolyFatherHtml(html);
  if (rows.length < 260) {
    throw new Error(`Expected ~267 popes, got ${rows.length}`);
  }
  const saints = loadSantoral();
  const corpus = loadCorpusDocs();
  const links = linkCorpusToPopes(corpus);
  const docsByPope = new Map<string, typeof links>();
  for (const l of links) {
    const arr = docsByPope.get(l.popeId) || [];
    arr.push(l);
    docsByPope.set(l.popeId, arr);
  }

  let catalog = loadExistingCatalog();
  if (argFlag('--scrape-indexes')) {
    console.log('[papacy] scraping vatican.va papal indexes…');
    catalog = await scrapeIndexes();
    ensureDir(INVENTORY_DIR);
    fs.writeFileSync(
      path.join(INVENTORY_DIR, 'apostolic-letters.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourceNote:
            'Índices vatican.va (apost_letters, encyclicals, apost_exhortations, apost_constitutions, motu_proprio). No es el corpus de lectura; son fichas de catálogo para importar.',
          count: catalog.length,
          documents: catalog,
        },
        null,
        2,
      ) + '\n',
      'utf-8',
    );
    console.log(`[papacy] catalogued ${catalog.length} vatican.va documents`);
  }

  const catalogByPope = new Map<string, CataloguedPapalDoc[]>();
  const corpusUrlSet = new Set(
    corpus.map((d) => (d.sourceUrl || '').replace(/https?:\/\/(www\.)?vatican\.va/i, '')),
  );
  for (const c of catalog) {
    const arr = catalogByPope.get(c.popeId) || [];
    const key = (c.sourceUrl || '').replace(/https?:\/\/(www\.)?vatican\.va/i, '');
    const inCorpus = corpusUrlSet.has(key);
    arr.push({ ...c, inCorpus });
    catalogByPope.set(c.popeId, arr);
  }

  const ids = new Set<string>();
  const popes: PopeRecord[] = rows.map((row) => {
    let id = row.id;
    if (ids.has(id)) {
      id = `${id}-${row.ordinal}`;
    }
    ids.add(id);
    const saint = matchPopeToSaint({ id, name: row.name, ordinal: row.ordinal }, saints);
    const era = eraForCentury(row.century);
    const years = compactReign(row);
    const linked = docsByPope.get(id) || [];
    const cat = catalogByPope.get(id) || [];
    const works: PapalWorkRef[] = [];
    const seenWork = new Set<string>();
    for (const l of linked) {
      const k = l.documentId;
      if (seenWork.has(k)) continue;
      seenWork.add(k);
      works.push({
        title: l.title,
        documentId: l.documentId,
        sourceUrl: l.sourceUrl,
        genre: l.genre,
        locale: l.locale,
        inCorpus: true,
      });
    }
    for (const c of cat) {
      if (!isPackCatalogEntry(c)) continue;
      const k = c.documentId || c.sourceUrl || c.title;
      if (!k || seenWork.has(k)) continue;
      seenWork.add(k);
      works.push({
        title: c.title,
        documentId: c.documentId,
        sourceUrl: c.sourceUrl,
        genre: c.genre,
        date: c.date,
        locale: c.locale || 'es',
        inCorpus: !!c.inCorpus,
      });
    }
    const record: PopeRecord = {
      id,
      ordinal: row.ordinal,
      name: row.name,
      displayName: row.name,
      secularName: row.secularName || undefined,
      birthplace: row.birthplace || undefined,
      reignStart: row.reignStart || undefined,
      reignEnd: row.reignEnd || undefined,
      century: row.century || undefined,
      years: years || undefined,
      vaticanSlug: row.vaticanSlug,
      vaticanPath: row.href,
      contentSlug: row.contentSlug,
      saintId: saint?.id,
      honor: honorFromSaint(saint),
      feastDays: saint?.feastDays,
      bio: composePopeBio(row, saint),
      sourceUrl: row.sourceUrl,
      locale: 'es',
      era: era.era,
      eraLabel: era.eraLabel,
      initials: popeInitials(row.name),
      meta: [`${row.ordinal}º`, years].filter(Boolean).join(' · '),
      documentIds: linked.map((l) => l.documentId).sort(),
      works,
      see: seeForOrdinal(row.ordinal),
      sourceNote: SOURCE_NOTE,
    };
    return record;
  });

  const manifest: PapacyManifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceUrl: SOURCE_URL,
    sourceNote: SOURCE_NOTE,
    popes,
  };

  const written = writePapacyPack(manifest);
  const slimCatalog = catalog.filter(isPackCatalogEntry);
  writePapacyDocumentsCatalog({
    generatedAt: manifest.generatedAt,
    sourceNote:
      'Catálogo ES vatican.va (cartas apostólicas, encíclicas, exhortaciones, constituciones, motu proprio). El inventario completo (todos los idiomas) está en documentos/papacy-source/inventory. Citas = documentId+unitIndex, nunca popeId.',
    documents: slimCatalog,
  });

  ensureDir(INVENTORY_DIR);
  fs.writeFileSync(
    path.join(INVENTORY_DIR, 'popes.json'),
    JSON.stringify(
      {
        generatedAt: manifest.generatedAt,
        count: popes.length,
        withSaint: popes.filter((p) => p.saintId).length,
        withCorpusDocs: popes.filter((p) => (p.documentIds || []).length).length,
        popes: popes.map((p) => ({
          id: p.id,
          ordinal: p.ordinal,
          name: p.name,
          saintId: p.saintId,
          documentIds: p.documentIds,
          workCount: (p.works || []).length,
        })),
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );

  console.log(
    `[papacy] wrote ${written.popeCount} popes → ${written.roots.join(', ')}`,
  );
  console.log(
    `[papacy] saints linked: ${popes.filter((p) => p.saintId).length}; corpus docs linked: ${links.length}; catalog: ${catalog.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
