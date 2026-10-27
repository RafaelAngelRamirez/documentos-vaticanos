/**
 * Encíclicas citadas en el corpus que no están en la descarga directa.
 *
 * Descarga directa = pack ya presente en documentos/corpus/manifest.json
 * cuya sourceUrl es una página de encíclica de vatican.va.
 *
 *   node scripts-descarga/measure_missing_encyclicals.js
 *   node scripts-descarga/measure_missing_encyclicals.js --out /tmp/enc.json
 *
 * No baja HTML ni escribe el corpus.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const CATALOG = path.join(
  REPO,
  'documentos/papacy-source/inventory/apostolic-letters.json',
);
const MANIFEST = path.join(REPO, 'documentos/corpus/manifest.json');
const DOCS = path.join(REPO, 'documentos/corpus/documents');
const SOURCES = path.join(REPO, 'scripts-descarga/config/sources.json');

const LOCALE_RANK = { es: 0, la: 1, en: 2, it: 3, fr: 4, pt: 5, de: 6, pl: 7 };
const IMPORT_LOCALES = new Set(['es', 'en', 'ar', 'zh']);
const GENERIC_SLUG =
  /^(beatification|beatifications|motu-proprio|letter|enciclica|encyclica|document|carta|index|encyclicals)$/i;

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function filenameFromUrl(url) {
  const last = String(url || '').split('/').filter(Boolean).pop() || '';
  return last.replace(/\.html?$/i, '');
}

/** Mirror of src/papacy/slug.ts slugFromFilename, plus encyclica- date tails. */
function encyclicalSlug(url) {
  let s = filenameFromUrl(url);
  s = s.replace(/^hf_[a-z0-9-]+_(enc|apl|exh|apc|motu-proprio)_/i, '');
  s = s.replace(/^papa-francesco-motu-proprio-\d{8}_/i, '');
  s = s.replace(/^papa-francesco_\d{8}_/i, '');
  s = s.replace(/^papa-francesco[-_]/i, '');
  s = s.replace(/^\d{8}[-_]/, '');
  s = s.replace(
    /^(enciclica|lettera-ap|motu-proprio|exhortacion|apost-letter|encyclica)[-_]/i,
    '',
  );
  s = s.toLowerCase().replace(/_/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  s = s.replace(/-\d{1,2}-[a-z]+-\d{3,4}$/i, '');
  s = s.replace(/-\d{4}-\d{2}-\d{2}$/i, '');
  return s;
}

function isEncyclicalUrl(url) {
  const u = String(url || '').toLowerCase();
  return /encyclicals|\/enc_|encyclica/.test(u);
}

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[‐‑–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localeOfUrl(url, fallback) {
  const m = String(url).match(/\/content\/[^/]+\/([a-z]{2}(?:_[a-z]{2})?)\//i);
  if (m) return m[1].toLowerCase();
  const holy = String(url).match(/\/holy_father\/[^/]+\/([a-z]{2})\//i);
  if (holy) return holy[1].toLowerCase();
  return (fallback || '').toLowerCase();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadCatalog() {
  const raw = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const rows = Array.isArray(raw) ? raw : raw.documents || [];
  const groups = new Map();
  for (const row of rows) {
    const url = String(row.sourceUrl || '').trim();
    if (!url || /\.index\.html$/i.test(url)) continue;
    const genre = row.genre || '';
    if (genre !== 'encyclical' && !isEncyclicalUrl(url)) continue;
    if (genre && genre !== 'encyclical' && !isEncyclicalUrl(url)) continue;
    if (!isEncyclicalUrl(url) && genre !== 'encyclical') continue;
    const slug = encyclicalSlug(url);
    if (!slug || GENERIC_SLUG.test(slug) || slug.length < 4) continue;
    let g = groups.get(slug);
    if (!g) {
      g = {
        slug,
        popeId: row.popeId || null,
        titles: [],
        urls: [],
      };
      groups.set(slug, g);
    }
    if (row.popeId && !g.popeId) g.popeId = row.popeId;
    if (row.title) g.titles.push(String(row.title));
    const locale = localeOfUrl(url, row.locale);
    g.urls.push({ url, locale, title: row.title || '' });
  }
  return groups;
}

function pickOfficial(group) {
  const ranked = group.urls
    .filter((u) => /vatican\.va/i.test(u.url) && /\.html?$/i.test(u.url))
    .slice()
    .sort((a, b) => {
      const ra = LOCALE_RANK[a.locale] ?? 50;
      const rb = LOCALE_RANK[b.locale] ?? 50;
      if (ra !== rb) return ra - rb;
      const aDoc = /\/documents\//i.test(a.url) ? 0 : 1;
      const bDoc = /\/documents\//i.test(b.url) ? 0 : 1;
      return aDoc - bDoc;
    });
  return ranked[0] || null;
}

function displayTitle(group, official) {
  const phrase = group.slug.replace(/-/g, ' ');
  const candidates = group.titles.filter((t) => {
    const f = fold(t);
    return f.includes(phrase) && !/^enc[ií]clicas?$/i.test(f);
  });
  if (official && official.title && fold(official.title).includes(phrase)) {
    return official.title.replace(/\s+/g, ' ').trim();
  }
  if (candidates.length) {
    candidates.sort((a, b) => a.length - b.length);
    return candidates[0].replace(/\s+/g, ' ').trim();
  }
  return phrase.replace(/\b\w/g, (c) => c.toUpperCase());
}

const LOCALE_SUFFIX =
  /-(es|en|ar|zh|hi|la|it|fr|pt|de|pl|zh-cn|zh_cn)$/i;
const PREFERRED_LOCALE = { es: 0, la: 1, en: 2, it: 3, fr: 4, pt: 5, de: 6 };

function baseDocId(id) {
  return String(id || '').replace(LOCALE_SUFFIX, '');
}

function localeFromDocId(id) {
  const m = String(id || '').match(LOCALE_SUFFIX);
  return m ? m[1].toLowerCase().replace('_', '-') : '';
}

function loadDirectDownload(groups) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const inCorpus = new Map();
  const docSlug = new Map();
  for (const doc of manifest.documents || []) {
    const url = doc.sourceUrl || '';
    if (!isEncyclicalUrl(url)) continue;
    const slug = encyclicalSlug(url);
    if (!slug || GENERIC_SLUG.test(slug)) continue;
    if (!inCorpus.has(slug)) inCorpus.set(slug, []);
    inCorpus.get(slug).push(doc.id);
    docSlug.set(doc.id, slug);
    if (!groups.has(slug)) {
      groups.set(slug, {
        slug,
        popeId: null,
        titles: doc.title ? [doc.title] : [],
        urls: [{ url, locale: doc.locale || localeOfUrl(url), title: doc.title || '' }],
        fromCorpusOnly: true,
      });
    }
  }
  return {
    inCorpus,
    docSlug,
    docCount: (manifest.documents || []).length,
    documents: manifest.documents || [],
  };
}

function preferredCopies(documents) {
  const groups = new Map();
  for (const doc of documents) {
    const base = baseDocId(doc.id);
    const locale = (doc.locale || localeFromDocId(doc.id) || '').toLowerCase();
    const rank = PREFERRED_LOCALE[locale] ?? 20;
    const prev = groups.get(base);
    if (!prev || rank < prev.rank) groups.set(base, { id: doc.id, rank, locale });
  }
  return new Set([...groups.values()].map((g) => g.id));
}

function loadSources(groups) {
  const file = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
  const bySlug = new Map();
  for (const src of file.sources || []) {
    const urls = src.seedUrls || [];
    for (const url of urls) {
      if (!isEncyclicalUrl(url)) continue;
      const slug = encyclicalSlug(url);
      if (!groups.has(slug)) continue;
      bySlug.set(slug, src.id);
    }
    const idSlug = String(src.id || '').replace(/-(es|en|la|ar|zh)$/i, '');
    if (groups.has(idSlug) && !bySlug.has(idSlug)) bySlug.set(idSlug, src.id);
    const corpusSlug = String(src.corpusDocId || '').replace(/-(es|en|la|ar|zh)$/i, '');
    if (groups.has(corpusSlug) && !bySlug.has(corpusSlug)) {
      bySlug.set(corpusSlug, src.id);
    }
  }
  return bySlug;
}

function scriptCanDownload(group, sourceId) {
  if (sourceId) {
    return {
      yes: true,
      via: `npm run scrape -- --source ${sourceId}`,
    };
  }
  const html = group.urls.filter(
    (u) =>
      /vatican\.va/i.test(u.url) &&
      /\/documents\//i.test(u.url) &&
      /\.html?$/i.test(u.url) &&
      !/\.index\.html$/i.test(u.url),
  );
  const hit = html.find((u) => IMPORT_LOCALES.has(u.locale));
  if (hit) {
    return {
      yes: true,
      via: 'npx ts-node --transpile-only import_papal_catalog.ts',
    };
  }
  if (html.length) {
    const locales = [...new Set(html.map((u) => u.locale || '?'))].sort();
    return {
      yes: false,
      via: null,
      note: `HTML vatican.va en ${locales.join(', ')}; import_papal_catalog.ts solo acepta es, en, ar, zh`,
    };
  }
  return { yes: false, via: null, note: 'sin HTML de documento en vatican.va' };
}

function matchPhrase(group) {
  const slugPhrase = group.slug.replace(/-/g, ' ');
  const incipits = [];
  for (const title of group.titles || []) {
    const inc = fold(String(title).split('(')[0]);
    if (!inc || /^enciclicas?$/.test(inc)) continue;
    incipits.push(inc);
  }
  const longer = [
    ...new Set(incipits.filter((inc) => inc.startsWith(`${slugPhrase} `))),
  ];
  if (longer.length === 1) {
    const agreed = longer[0];
    const votes = incipits.filter((inc) => inc === agreed).length;
    if (votes >= 2) return agreed;
  }
  return slugPhrase;
}

function buildMatcher(groups, inCorpus) {
  const taken = new Set();
  for (const group of groups.values()) {
    taken.add(matchPhrase(group));
    taken.add(group.slug.replace(/-/g, ' '));
  }
  const missing = [];
  for (const group of groups.values()) {
    if (inCorpus.has(group.slug)) continue;
    const phrase = matchPhrase(group);
    const words = phrase.split(' ').filter(Boolean);
    if (words.length === 0) continue;
    if (phrase.length < 6) continue;
    missing.push({
      slug: group.slug,
      phrase,
      words: words.length,
      group,
    });
    if (words.length >= 3) {
      const short = words.slice(0, 2).join(' ');
      const blocked = [...taken].some(
        (other) => other !== phrase && (other === short || other.startsWith(`${short} `)),
      );
      if (!blocked && short.length >= 8) {
        missing.push({
          slug: group.slug,
          phrase: short,
          words: 2,
          group,
        });
      }
    }
  }
  missing.sort((a, b) => b.phrase.length - a.phrase.length);
  const multi = missing.filter((m) => m.words >= 2);
  const single = missing.filter((m) => m.words === 1);
  const multiRe = multi.length
    ? new RegExp(`\\b(?:${multi.map((m) => escapeRe(m.phrase)).join('|')})\\b`, 'gi')
    : null;
  const singleRe = single.length
    ? new RegExp(`\\b(?:${single.map((m) => escapeRe(m.phrase)).join('|')})\\b`, 'gi')
    : null;
  const markerRe =
    /enciclicas?|carta\s+enc\.?|\benc\.|encyclical|encyclica|litterae\s+encyclicae/i;
  const phraseToSlug = new Map();
  for (const m of missing) phraseToSlug.set(m.phrase, m.slug);
  return { missing, multiRe, singleRe, markerRe, phraseToSlug };
}

const MARKER_RE =
  /enciclicas?|cartas?\s+enc(?:iclica)?\.?|\benc\.|encyclicals?|litterae\s+encyclicae/gi;
const SPANISH_GAP =
  /\b(el|la|los|las|que|en|con|para|del|por|su|sus|como|nos|esta|este|una|un|al|se|lo|ya|mas|pero|sobre|desde|entre|fue|son)\b/;

function markerBefore(text, index) {
  const from = Math.max(0, index - 420);
  const before = text.slice(from, index);
  MARKER_RE.lastIndex = 0;
  let last = -1;
  let m;
  while ((m = MARKER_RE.exec(before))) last = m.index + m[0].length;
  if (last < 0) return false;
  const between = before.slice(last);
  if (/\.\s/.test(between)) return false;
  if (between.length > 80 && SPANISH_GAP.test(between)) return false;
  return true;
}

function citationAfter(text, end) {
  const after = text.slice(end, end + 48);
  return /\baas\b|\b(?:18|19|20)\d{2}\b/.test(after);
}

function countFile(file, matcher, docId, ownSlug, counts, citers) {
  let units;
  try {
    units = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  if (!Array.isArray(units)) return;
  const regs = [matcher.multiRe, matcher.singleRe].filter(Boolean);
  for (const unit of units) {
    const raw = unit && unit.contenido;
    if (!raw || raw.length < 8) continue;
    const text = fold(raw);
    for (const re of regs) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const slug = matcher.phraseToSlug.get(m[0].toLowerCase());
        if (!slug || slug === ownSlug) continue;
        const marked =
          markerBefore(text, m.index) || citationAfter(text, m.index + m[0].length);
        if (!marked) continue;
        const row = counts.get(slug);
        row.timesCited += 1;
        const bag = citers.get(slug);
        bag.set(docId, (bag.get(docId) || 0) + 1);
      }
    }
  }
}

function main() {
  const t0 = Date.now();
  const groups = loadCatalog();
  const catalogSlugCount = groups.size;
  const { inCorpus, docSlug, docCount, documents } = loadDirectDownload(groups);
  const sourcesBySlug = loadSources(groups);
  const preferred = preferredCopies(documents);
  const matcher = buildMatcher(groups, inCorpus);
  const counts = new Map();
  const citers = new Map();
  for (const item of matcher.missing) {
    counts.set(item.slug, {
      slug: item.slug,
      phrase: item.phrase,
      timesCited: 0,
      group: item.group,
    });
    citers.set(item.slug, new Map());
  }

  const ids = fs.readdirSync(DOCS).filter((id) => preferred.has(id));
  let scanned = 0;
  for (const id of ids) {
    const file = path.join(DOCS, id, 'content.json');
    if (!fs.existsSync(file)) continue;
    countFile(file, matcher, id, docSlug.get(id) || null, counts, citers);
    scanned += 1;
    if (scanned % 200 === 0) {
      process.stderr.write(`[measure] ${scanned}/${ids.length}\n`);
    }
  }

  const cited = [];
  for (const row of counts.values()) {
    if (row.timesCited < 1) continue;
    const official = pickOfficial(row.group);
    const sourceId = sourcesBySlug.get(row.slug) || null;
    const can = scriptCanDownload(row.group, sourceId);
    const byDoc = [...citers.get(row.slug).entries()].sort((a, b) => b[1] - a[1]);
    cited.push({
      slug: row.slug,
      title: displayTitle(row.group, official),
      popeId: row.group.popeId,
      timesCited: row.timesCited,
      officialSource: official ? official.url : null,
      officialLocale: official ? official.locale : null,
      scriptCanDownload: can.yes,
      script: can.via,
      note: can.note || null,
      alreadyInSources: Boolean(sourceId),
      topCiters: byDoc.slice(0, 5).map(([id, n]) => ({ id, n })),
    });
  }
  cited.sort((a, b) => b.timesCited - a.timesCited || a.slug.localeCompare(b.slug));

  const report = {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    corpusDocumentsScanned: scanned,
    corpusManifestDocuments: docCount,
    catalogEncyclicalSlugs: catalogSlugCount,
    inDirectDownload: inCorpus.size,
    missingFromDirectDownload: new Set(matcher.missing.map((m) => m.slug)).size,
    citedMissing: cited.length,
    citedMissingCanDownload: cited.filter((c) => c.scriptCanDownload).length,
    citationTotal: cited.reduce((a, c) => a + c.timesCited, 0),
    method: {
      directDownload:
        'Pack en documentos/corpus/manifest.json con sourceUrl de encíclica vatican.va (encyclicals, /enc_ o encyclica).',
      citation:
        'Íncipit latino del slug vatican.va (si el título oficial alarga el slug y coinciden al menos dos fichas, se usa ese título). Cuenta si hay marca enc./encíclica/encyclical en los 420 caracteres previos, sin punto de por medio y sin prosa española en el hueco cuando pasa de 80 caracteres, o si justo después aparece AAS o un año. No cuenta el propio texto. Traducciones gemelas: una sola copia (es, si no la, en, it).',
      script:
        'Sí si sources.json ya tiene la semilla (npm run scrape) o el catálogo tiene HTML vatican.va en es/en/ar/zh (import_papal_catalog.ts). Latín u otro idioma solo: no.',
    },
    items: cited,
  };

  const out = argValue('--out');
  const json = JSON.stringify(report, null, 2);
  if (out) fs.writeFileSync(out, json);
  else process.stdout.write(json + '\n');
  process.stderr.write(
    `[measure] catalog=${catalogSlugCount} direct=${inCorpus.size} missing=${report.missingFromDirectDownload} cited=${cited.length} can=${report.citedMissingCanDownload} ms=${report.elapsedMs}\n`,
  );
}

function selfTest() {
  const orientales = matchPhrase({
    slug: 'orientales',
    titles: [
      'Orientales Ecclesias (15 de diciembre de 1952)',
      'Orientales Ecclesias (15 de diciembre de 1952)',
      'Orientales Ecclesias (15 de diciembre de 1952)',
    ],
  });
  if (orientales !== 'orientales ecclesias') {
    throw new Error(`orientales phrase: ${orientales}`);
  }
  const lux = matchPhrase({
    slug: 'lux-veritatis',
    titles: [
      'Lux Veritatis (25 de diciembre de 1931)',
      'Caritate Christi Compulsi (3 de mayo de 1932)',
    ],
  });
  if (lux !== 'lux veritatis') throw new Error(`lux phrase: ${lux}`);
  const prose =
    'recordo en la enciclica lux veritatis el concilio, asi nos. tanto entre los orientales, que incluso';
  const idx = prose.indexOf('orientales');
  if (markerBefore(prose, idx)) {
    throw new Error('prose gap should not count orientales');
  }
  const list =
    'en nuestras enciclicas miserentissimus redemptor , quadragesimo anno, caritate christi , acerba animi , dilectissima';
  const acerba = list.indexOf('acerba animi');
  if (!markerBefore(list, acerba)) throw new Error('list citation should count');
  const aas = 'en studiorum ducem, aas, xv, 1923, pagina 324';
  const at = aas.indexOf('studiorum ducem');
  if (!citationAfter(aas, at + 'studiorum ducem'.length)) {
    throw new Error('aas tail should count');
  }
  console.log('measure_missing_encyclicals self-test: ok');
}

if (process.argv.includes('--self-test')) selfTest();
else if (require.main === module) main();
