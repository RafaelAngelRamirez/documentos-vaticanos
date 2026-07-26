/**
 * Hub multi-label topic assignment → topic-postings.json (dual-write).
 *
 * Flags:
 *   --locale es
 *   --hubs-only (default true)
 *   --expand / --no-expand  improved matching (default true, PR4c)
 *   --seed <path>  override seed file
 *   --max-postings 200
 *   --threshold 1
 *   --write-catalog  force rewrite topics.json + term-topics from seed/fixture
 *
 * Usage:
 *   npx ts-node --transpile-only build_topic_postings.ts --locale es
 *   npm run topics:build-postings -- --locale es
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ALIAS_TERM_WEIGHT,
  AssignTopic,
  MAX_POSTINGS_PER_TOPIC,
  MAX_TOPICS_PER_UNIT,
  MINIMAL_SEED_FIXTURE_ES,
  SCORE_THRESHOLD,
  SeedTopicInput,
  TopicCitation,
  assignTopicsToUnit,
  buildTermTopicsMap,
  capPostings,
  isHubDocument,
  topicsFromPack,
  topicsFromSeed,
  toPackCitation,
  toTopicRecords,
} from './src/topics/assign_logic';

const REPO = path.resolve(__dirname, '..');
const CORPUS_ROOTS = [
  path.join(REPO, 'documentos', 'corpus'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus'),
];
const DEFAULT_SEED = path.join(
  __dirname,
  'config',
  'topics-seed.es.json',
);

interface ManifestDoc {
  id: string;
  locale?: string;
  kind?: string;
  bodyPath?: string;
  unitCount?: number;
}

function parseArgs(argv: string[]) {
  let locale = 'es';
  let hubsOnly = true;
  let expand = true;
  let seedPath = DEFAULT_SEED;
  let maxPostings = MAX_POSTINGS_PER_TOPIC;
  let threshold = SCORE_THRESHOLD;
  let writeCatalog = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--locale' && argv[i + 1]) locale = argv[++i];
    else if (a === '--hubs-only') hubsOnly = true;
    else if (a === '--all-kinds') hubsOnly = false;
    else if (a === '--expand') expand = true;
    else if (a === '--no-expand') expand = false;
    else if (a === '--seed' && argv[i + 1]) seedPath = path.resolve(argv[++i]);
    else if (a === '--max-postings' && argv[i + 1])
      maxPostings = Math.max(1, parseInt(argv[++i], 10) || MAX_POSTINGS_PER_TOPIC);
    else if (a === '--threshold' && argv[i + 1])
      threshold = Math.max(0.1, parseFloat(argv[++i]) || SCORE_THRESHOLD);
    else if (a === '--write-catalog') writeCatalog = true;
    else if (a === '--help') {
      console.log(
        `Usage: build_topic_postings.ts [--locale es] [--hubs-only] [--expand|--no-expand] [--seed path] [--max-postings 200] [--threshold 1] [--write-catalog]`,
      );
      process.exit(0);
    }
  }
  return {
    locale,
    hubsOnly,
    expand,
    seedPath,
    maxPostings,
    threshold,
    writeCatalog,
  };
}

function loadManifest(root: string): {
  version: string | number;
  documents: ManifestDoc[];
} {
  const p = path.join(root, 'manifest.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    version: raw.version ?? '0',
    documents: Array.isArray(raw.documents) ? raw.documents : [],
  };
}

function resolveBodyPath(root: string, meta: ManifestDoc): string {
  if (meta.bodyPath) {
    const cleaned = meta.bodyPath.replace(/^\//, '');
    if (cleaned.startsWith('assets/corpus/')) {
      return path.join(root, cleaned.replace(/^assets\/corpus\//, ''));
    }
    return path.join(root, cleaned);
  }
  return path.join(root, 'documents', meta.id, 'content.json');
}

function loadSeedFile(seedPath: string): SeedTopicInput[] | null {
  if (!fs.existsSync(seedPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.topics)
        ? raw.topics
        : null;
    if (!list?.length) return null;
    return list as SeedTopicInput[];
  } catch (e) {
    console.warn(`Failed to parse seed ${seedPath}`, e);
    return null;
  }
}

function loadPackTopics(
  locDir: string,
  locale: string,
): AssignTopic[] | null {
  const topicsPath = path.join(locDir, 'topics.json');
  if (!fs.existsSync(topicsPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
    const list = Array.isArray(raw?.topics) ? raw.topics : [];
    if (!list.length) return null;
    let termTopics: Record<string, Array<{ topicId: string; w: number }>> | undefined;
    const ttPath = path.join(locDir, 'term-topics.json');
    if (fs.existsSync(ttPath)) {
      try {
        const tt = JSON.parse(fs.readFileSync(ttPath, 'utf8'));
        if (tt?.terms && typeof tt.terms === 'object') termTopics = tt.terms;
      } catch {
        /* ignore */
      }
    }
    return topicsFromPack(locale, list, termTopics);
  } catch {
    return null;
  }
}

function resolveCatalog(
  locale: string,
  locDir: string,
  seedPath: string,
  writeCatalog: boolean,
): { topics: AssignTopic[]; source: string; shouldWriteCatalog: boolean } {
  // Prefer seed file for assignment terms (phrase-aware). Pack topics.json is
  // metadata for runtime; term-topics may tokenize multi-word aliases poorly.
  const seed = loadSeedFile(seedPath);
  if (seed?.length) {
    const fromPack = loadPackTopics(locDir, locale);
    const packHasCatalog = !!(fromPack && fromPack.length);
    return {
      topics: topicsFromSeed(seed, locale),
      source: `seed ${path.relative(REPO, seedPath)}`,
      // Only write catalog if pack empty or --write-catalog
      shouldWriteCatalog: writeCatalog || !packHasCatalog,
    };
  }
  if (!writeCatalog) {
    const fromPack = loadPackTopics(locDir, locale);
    if (fromPack?.length) {
      return {
        topics: fromPack,
        source: 'pack topics.json',
        shouldWriteCatalog: false,
      };
    }
  }
  if (locale === 'es') {
    const fromPack = loadPackTopics(locDir, locale);
    return {
      topics: topicsFromSeed(MINIMAL_SEED_FIXTURE_ES, locale),
      source: 'MINIMAL_SEED_FIXTURE_ES',
      shouldWriteCatalog: writeCatalog || !(fromPack && fromPack.length),
    };
  }
  console.error(
    `No topic catalog for locale=${locale}. Provide topics.json or --seed.`,
  );
  process.exit(1);
}

function main() {
  const {
    locale,
    hubsOnly,
    expand,
    seedPath,
    maxPostings,
    threshold,
    writeCatalog,
  } = parseArgs(process.argv.slice(2));
  const primary = CORPUS_ROOTS[0];
  if (!fs.existsSync(path.join(primary, 'manifest.json'))) {
    console.error(`Missing manifest under ${primary}`);
    process.exit(1);
  }

  const man = loadManifest(primary);
  const localeDocs = man.documents.filter((d) => {
    const loc = (d.locale || '').toLowerCase();
    if (loc === locale) return true;
    return d.id.toLowerCase().endsWith(`-${locale}`);
  });

  const hubDocs = hubsOnly
    ? localeDocs.filter((d) => isHubDocument(d, locale))
    : localeDocs;

  const locDir = path.join(primary, 'search', locale);
  fs.mkdirSync(locDir, { recursive: true });

  const catalog = resolveCatalog(locale, locDir, seedPath, writeCatalog);
  const topics = catalog.topics;
  if (!topics.length) {
    console.error('Empty topic catalog');
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        phase: 'start',
        locale,
        hubsOnly,
        expand,
        catalogSource: catalog.source,
        topicCount: topics.length,
        hubDocs: hubDocs.length,
        threshold,
        maxPostings,
        maxTopicsPerUnit: MAX_TOPICS_PER_UNIT,
      },
      null,
      2,
    ),
  );

  /** topicId → citations (pre-cap) */
  const buckets = new Map<string, TopicCitation[]>();
  for (const t of topics) buckets.set(t.id, []);

  let unitsScanned = 0;
  let assignments = 0;
  let docsScanned = 0;
  let docsSkipped = 0;

  for (const meta of hubDocs) {
    const bodyPath = resolveBodyPath(primary, meta);
    if (!fs.existsSync(bodyPath)) {
      console.warn(`skip missing body ${meta.id}: ${bodyPath}`);
      docsSkipped++;
      continue;
    }
    let units: Array<{
      contenido?: string;
      consecutivo?: string;
      referencias?: unknown;
    }>;
    try {
      units = JSON.parse(fs.readFileSync(bodyPath, 'utf8'));
    } catch (e) {
      console.warn(`skip parse ${meta.id}`, e);
      docsSkipped++;
      continue;
    }
    if (!Array.isArray(units)) {
      docsSkipped++;
      continue;
    }
    docsScanned++;
    const kind = meta.kind;

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const text = u?.contenido || '';
      unitsScanned++;
      if (!text || text.length < 12) continue;
      const hits = assignTopicsToUnit(text, topics, {
        maxTopics: MAX_TOPICS_PER_UNIT,
        threshold,
        expand,
      });
      if (!hits.length) continue;
      for (const h of hits) {
        const list = buckets.get(h.topicId);
        if (!list) continue;
        list.push({
          documentId: meta.id,
          unitIndex: i,
          conf: h.conf,
          consecutivo:
            u.consecutivo != null && u.consecutivo !== 'no-encontrado'
              ? String(u.consecutivo)
              : undefined,
          kind,
        });
        assignments++;
      }
    }

    // free units ASAP
    units = [];
  }

  const postings: Record<string, ReturnType<typeof toPackCitation>[]> = {};
  const stats = new Map<string, { unitCount: number; documentCount: number }>();
  let postingsTotal = 0;
  const topicCounts: Array<{ topicId: string; count: number }> = [];

  for (const t of topics) {
    const raw = buckets.get(t.id) || [];
    const capped = capPostings(raw, maxPostings);
    const packList = capped.map(toPackCitation);
    postings[t.id] = packList;
    postingsTotal += packList.length;
    topicCounts.push({ topicId: t.id, count: packList.length });
    const docs = new Set(packList.map((c) => c.documentId));
    stats.set(t.id, {
      unitCount: packList.length,
      documentCount: docs.size,
    });
  }

  topicCounts.sort((a, b) => b.count - a.count);
  const topTopics = topicCounts.slice(0, 20);

  const postingsFile = {
    version: 1,
    locale,
    postings,
  };

  const fingerprintDocs = localeDocs
    .map((d) => `${d.id}|${d.unitCount ?? ''}|${d.bodyPath || ''}`)
    .sort()
    .join('\n');
  const fp = crypto
    .createHash('sha256')
    .update(fingerprintDocs)
    .digest('hex')
    .slice(0, 16);

  const shouldWriteCatalog = catalog.shouldWriteCatalog || writeCatalog;
  const topicRecords = toTopicRecords(topics, stats);
  const termTopics = buildTermTopicsMap(topics);
  const generatedAt = new Date().toISOString();
  const postingsJson = JSON.stringify(postingsFile) + '\n';

  // Build shared locale manifest from primary root state, then dual-write identical bytes.
  const primaryLocDir = path.join(primary, 'search', locale);
  let edgeCount: number | undefined;
  let prevFiles: Record<string, string> = {};
  let prevVersion = '0.2.0';
  const primaryManPath = path.join(primaryLocDir, 'manifest.json');
  if (fs.existsSync(primaryManPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(primaryManPath, 'utf8'));
      edgeCount = prev.edgeCount;
      prevFiles = prev.files || {};
      prevVersion = prev.version || prevVersion;
    } catch {
      /* */
    }
  }
  const hasGraph =
    !!prevFiles.graph ||
    fs.existsSync(path.join(primaryLocDir, 'unit-graph.json'));
  const locMan = {
    version: prevVersion,
    schema: 1,
    locale,
    generatedAt,
    corpusFingerprint: {
      algo: 'sha256',
      value: fp,
      docCount: localeDocs.length,
    },
    caps: {
      maxTopics: 250,
      maxPostingsPerTopic: maxPostings,
      maxRawBytes: 12_000_000,
    },
    topicCount: topics.length,
    ...(edgeCount != null ? { edgeCount } : {}),
    files: {
      topics: prevFiles.topics || 'topics.json',
      postings: 'topic-postings.json',
      termTopics: prevFiles.termTopics || 'term-topics.json',
      ...(hasGraph ? { graph: prevFiles.graph || 'unit-graph.json' } : {}),
    },
    sourceNote: `Hub topic postings for locale ${locale}. catalog=${catalog.source}; expand=${expand}; hubs=${docsScanned}; assignments=${assignments}; postings=${postingsTotal}.`,
  };
  const locManJson = JSON.stringify(locMan, null, 2) + '\n';

  // Always refresh topics.json unitCount/documentCount when building postings
  // (merge with existing catalog metadata; full rewrite if --write-catalog).
  let topicsJsonOut: string | null = null;
  if (shouldWriteCatalog) {
    topicsJsonOut = JSON.stringify({ topics: topicRecords }, null, 2) + '\n';
  } else {
    const topicsPath = path.join(primaryLocDir, 'topics.json');
    if (fs.existsSync(topicsPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
        const list = Array.isArray(prev?.topics) ? prev.topics : [];
        if (list.length) {
          const updated = list.map(
            (row: {
              id?: string;
              slug?: string;
              unitCount?: number;
              documentCount?: number;
            }) => {
              const id =
                row.id || (row.slug ? `topic:${locale}:${row.slug}` : '');
              const st = stats.get(id);
              if (!st) return row;
              return {
                ...row,
                unitCount: st.unitCount,
                documentCount: st.documentCount,
              };
            },
          );
          topicsJsonOut =
            JSON.stringify({ ...prev, topics: updated }, null, 2) + '\n';
        }
      } catch {
        /* leave */
      }
    }
    // Fallback: write from assign catalog if pack topics.json missing
    if (!topicsJsonOut) {
      topicsJsonOut = JSON.stringify({ topics: topicRecords }, null, 2) + '\n';
    }
  }
  const termTopicsJson = shouldWriteCatalog
    ? JSON.stringify({ version: 1, locale, terms: termTopics }, null, 2) + '\n'
    : null;

  for (const root of CORPUS_ROOTS) {
    const searchRoot = path.join(root, 'search');
    const outDir = path.join(searchRoot, locale);
    fs.mkdirSync(outDir, { recursive: true });

    // Do not touch unit-graph.json
    const postingsPath = path.join(outDir, 'topic-postings.json');
    fs.writeFileSync(postingsPath, postingsJson);

    if (topicsJsonOut) {
      fs.writeFileSync(path.join(outDir, 'topics.json'), topicsJsonOut);
    }
    if (termTopicsJson) {
      fs.writeFileSync(path.join(outDir, 'term-topics.json'), termTopicsJson);
    }

    fs.writeFileSync(path.join(outDir, 'manifest.json'), locManJson);

    // root search-manifest
    const rootManPath = path.join(searchRoot, 'search-manifest.json');
    let rootMan: {
      version: string;
      schema: number;
      locales: Record<string, string>;
      sourceNote?: string;
    } = {
      version: '0.2.0',
      schema: 1,
      locales: { [locale]: locale },
      sourceNote: 'Topic-search pack (hub postings PR4c).',
    };
    if (fs.existsSync(rootManPath)) {
      try {
        rootMan = { ...rootMan, ...JSON.parse(fs.readFileSync(rootManPath, 'utf8')) };
        rootMan.locales = { ...(rootMan.locales || {}), [locale]: locale };
      } catch {
        /* */
      }
    }
    rootMan.sourceNote = 'Topic-search pack (hub postings PR4c).';
    fs.writeFileSync(rootManPath, JSON.stringify(rootMan, null, 2) + '\n');

    const bytes = fs.statSync(postingsPath).size;
    console.log(
      `wrote ${path.relative(REPO, postingsPath)} (${(bytes / 1024).toFixed(1)} KiB)`,
    );
  }

  // ensure unit-graph still present on primary
  const graphPath = path.join(primary, 'search', locale, 'unit-graph.json');
  if (!fs.existsSync(graphPath)) {
    console.warn(`note: unit-graph.json missing at ${graphPath} (not deleted by this script)`);
  }

  // Empty / zero-posting topics (for quality report)
  const emptyTopics = topicCounts.filter((t) => t.count === 0).map((t) => t.topicId);

  console.log(
    JSON.stringify(
      {
        locale,
        hubsOnly,
        expand,
        catalogSource: catalog.source,
        catalogWritten: !!topicsJsonOut,
        topicsUnitCountsWritten: !!topicsJsonOut,
        docsScanned,
        docsSkipped,
        unitsScanned,
        assignments,
        postingsTotal,
        topicCount: topics.length,
        maxPostings,
        maxTopicsPerUnit: MAX_TOPICS_PER_UNIT,
        topTopicsByPostings: topTopics,
        emptyTopicCount: emptyTopics.length,
        emptyTopics: emptyTopics.slice(0, 20),
        aliasWeight: ALIAS_TERM_WEIGHT,
        fingerprint: fp,
      },
      null,
      2,
    ),
  );
}

main();
