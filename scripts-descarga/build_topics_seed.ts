/**
 * Build seed topic catalog + term→topic map for offline topic search (PR4a).
 *
 * Reads: scripts-descarga/config/topics-seed.{locale}.json
 * Writes (dual): documentos/corpus/search/{locale}/ + frontend assets
 *   - topics.json
 *   - term-topics.json
 * Updates locale manifest: topicCount, files.topics/termTopics, generatedAt
 * Preserves unit-graph.json, topic-postings.json, edgeCount, graph path, fingerprint.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts-descarga/build_topics_seed.ts [--locale es]
 *   npm run topics:build-seed
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const CORPUS_ROOTS = [
  path.join(REPO, 'documentos', 'corpus'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus'),
];

const MAX_TOPICS = 250;
const TERM_W = 1;
const ALIAS_W = 0.7;

interface SeedTopic {
  slug: string;
  label: string;
  aliases?: string[];
  terms?: string[];
  parent?: string | null;
  related?: string[];
}

interface SeedFile {
  version: number;
  locale: string;
  topics: SeedTopic[];
  sourceNote?: string;
}

interface TopicRecord {
  id: string;
  slug: string;
  label: string;
  aliases?: string[];
  parentId?: string | null;
  relatedIds?: string[];
  kind: 'seed' | 'discovered';
}

function parseArgs(argv: string[]) {
  let locale = 'es';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--locale' && argv[i + 1]) locale = argv[++i];
    else if (a === '--help') {
      console.log('Usage: build_topics_seed.ts [--locale es]');
      process.exit(0);
    }
  }
  return { locale };
}

/** Same diacritic strip idea as frontend foldToken (keeps ñ). */
export function stripDiacritics(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(
      /([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,
      '$1',
    )
    .normalize();
}

export function cleanForIndex(texto: string): string {
  return texto
    .replace(/[,"\.«»"":;!¡¿?—']/gi, '')
    .replace(/\s/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\[\]”']/gi, '')
    .replace(/[-\(\)\*\/`‘–…]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function foldToken(raw: string): string {
  return cleanForIndex(stripDiacritics(raw)).toLowerCase().trim();
}

function topicId(locale: string, slug: string): string {
  return `topic:${locale}:${slug}`;
}

function assertSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid slug (kebab ascii only): ${JSON.stringify(slug)}`);
  }
}

function loadSeed(locale: string): SeedFile {
  const p = path.join(
    REPO,
    'scripts-descarga',
    'config',
    `topics-seed.${locale}.json`,
  );
  if (!fs.existsSync(p)) {
    throw new Error(`Missing seed file: ${p}`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as SeedFile;
  if (!Array.isArray(raw.topics)) {
    throw new Error('seed.topics must be an array');
  }
  return raw;
}

function buildCatalog(seed: SeedFile, locale: string): TopicRecord[] {
  const slugs = new Set<string>();
  for (const t of seed.topics) {
    assertSlug(t.slug);
    if (slugs.has(t.slug)) {
      throw new Error(`Duplicate seed slug: ${t.slug}`);
    }
    slugs.add(t.slug);
  }

  if (seed.topics.length > MAX_TOPICS) {
    throw new Error(
      `Seed has ${seed.topics.length} topics; cap is ${MAX_TOPICS}`,
    );
  }

  const out: TopicRecord[] = [];
  for (const t of seed.topics) {
    const parentSlug = t.parent || null;
    if (parentSlug && !slugs.has(parentSlug)) {
      throw new Error(`Topic ${t.slug}: unknown parent ${parentSlug}`);
    }
    const related = (t.related || []).filter((r) => {
      if (!slugs.has(r)) {
        throw new Error(`Topic ${t.slug}: unknown related ${r}`);
      }
      return r !== t.slug;
    });

    const rec: TopicRecord = {
      id: topicId(locale, t.slug),
      slug: t.slug,
      label: t.label,
      kind: 'seed',
      parentId: parentSlug ? topicId(locale, parentSlug) : null,
      relatedIds: related.map((r) => topicId(locale, r)),
    };
    if (t.aliases?.length) {
      rec.aliases = [...t.aliases];
    }
    out.push(rec);
  }

  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

function addTerm(
  map: Map<string, Map<string, number>>,
  termRaw: string,
  tid: string,
  w: number,
): void {
  const folded = foldToken(termRaw);
  if (!folded || folded.length < 2) return;
  // skip pure stop-ish single noise
  let byTopic = map.get(folded);
  if (!byTopic) {
    byTopic = new Map();
    map.set(folded, byTopic);
  }
  const prev = byTopic.get(tid) ?? 0;
  if (w > prev) byTopic.set(tid, w);
}

function buildTermTopics(
  seed: SeedFile,
  locale: string,
): Record<string, Array<{ topicId: string; w: number }>> {
  const map = new Map<string, Map<string, number>>();

  for (const t of seed.topics) {
    const tid = topicId(locale, t.slug);
    // primary terms
    for (const term of t.terms || []) {
      addTerm(map, term, tid, TERM_W);
    }
    // label as primary term
    addTerm(map, t.label, tid, TERM_W);
    // slug tokens as weak primary (hyphen → space)
    addTerm(map, t.slug.replace(/-/g, ' '), tid, TERM_W);

    // aliases: full phrase + split tokens at w=0.7
    for (const alias of t.aliases || []) {
      addTerm(map, alias, tid, ALIAS_W);
      const parts = foldToken(alias).split(/\s+/).filter(Boolean);
      for (const part of parts) {
        if (part.length >= 2) {
          addTerm(map, part, tid, ALIAS_W);
        }
      }
    }
  }

  const terms: Record<string, Array<{ topicId: string; w: number }>> = {};
  const keys = [...map.keys()].sort();
  for (const k of keys) {
    const entries = [...map.get(k)!.entries()]
      .map(([topicId, w]) => ({ topicId, w }))
      .sort(
        (a, b) =>
          b.w - a.w || a.topicId.localeCompare(b.topicId),
      );
    terms[k] = entries;
  }
  return terms;
}

function writeJson(filePath: string, body: unknown, pretty = true): void {
  const text = pretty
    ? JSON.stringify(body, null, 2) + '\n'
    : JSON.stringify(body) + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function updateLocaleManifest(
  locDir: string,
  locale: string,
  topicCount: number,
  sourceNote: string,
): void {
  const locManPath = path.join(locDir, 'manifest.json');
  const now = new Date().toISOString();
  let locMan: Record<string, unknown> = {
    version: '0.3.0',
    schema: 1,
    locale,
    generatedAt: now,
    corpusFingerprint: {
      algo: 'sha256',
      value: '',
      docCount: 0,
    },
    caps: {
      maxTopics: 250,
      maxPostingsPerTopic: 200,
      maxRawBytes: 12_000_000,
    },
    topicCount,
    files: {
      topics: 'topics.json',
      postings: 'topic-postings.json',
      termTopics: 'term-topics.json',
      graph: 'unit-graph.json',
    },
    sourceNote,
  };

  if (fs.existsSync(locManPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(locManPath, 'utf8'));
      const prevFiles = (prev.files || {}) as Record<string, string>;
      locMan = {
        ...prev,
        version: prev.version || '0.3.0',
        locale,
        generatedAt: now,
        topicCount,
        files: {
          ...prevFiles,
          topics: 'topics.json',
          termTopics: 'term-topics.json',
          postings: prevFiles.postings || 'topic-postings.json',
          // keep graph path if present
          ...(prevFiles.graph ? { graph: prevFiles.graph } : { graph: 'unit-graph.json' }),
          ...(prevFiles.docGraph
            ? { docGraph: prevFiles.docGraph }
            : { docGraph: 'doc-graph.json' }),
        },
        sourceNote,
        // preserve fingerprint + edgeCount from graph build
        corpusFingerprint: prev.corpusFingerprint || locMan.corpusFingerprint,
        edgeCount: prev.edgeCount,
        caps: prev.caps || locMan.caps,
      };
    } catch {
      /* use default */
    }
  }

  writeJson(locManPath, locMan);
}

function ensureCompanions(locDir: string, locale: string): void {
  const postingsPath = path.join(locDir, 'topic-postings.json');
  if (!fs.existsSync(postingsPath)) {
    writeJson(postingsPath, { version: 1, locale, postings: {} });
  }
  // never delete unit-graph.json / doc-graph.json
}

function updateRootSearchManifest(searchRoot: string, locale: string): void {
  const rootManPath = path.join(searchRoot, 'search-manifest.json');
  let rootMan: {
    version: string;
    schema: number;
    locales: Record<string, string>;
    sourceNote?: string;
  } = {
    version: '0.3.0',
    schema: 1,
    locales: { [locale]: locale },
    sourceNote: 'Topic-search pack: seed ontology + ref graph (PR4a).',
  };
  if (fs.existsSync(rootManPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(rootManPath, 'utf8'));
      rootMan = {
        ...rootMan,
        ...prev,
        locales: { ...(prev.locales || {}), [locale]: locale },
        sourceNote:
          prev.sourceNote ||
          'Topic-search pack: seed ontology + ref graph (PR4a).',
      };
    } catch {
      /* default */
    }
  }
  writeJson(rootManPath, rootMan);
}

function main() {
  const { locale } = parseArgs(process.argv.slice(2));
  const seed = loadSeed(locale);
  if (seed.locale && seed.locale !== locale) {
    console.warn(
      `seed.locale=${seed.locale} differs from --locale ${locale}; using --locale`,
    );
  }

  const topics = buildCatalog(seed, locale);
  const terms = buildTermTopics(seed, locale);
  const termCount = Object.keys(terms).length;
  const sourceNote = `Seed ontology (${topics.length} topics, ${termCount} terms) for locale ${locale}. Postings deferred to PR4b.`;

  const topicsFile = { topics };
  const termTopicsFile = {
    version: 1,
    locale,
    terms,
  };

  for (const root of CORPUS_ROOTS) {
    const searchRoot = path.join(root, 'search');
    const locDir = path.join(searchRoot, locale);
    fs.mkdirSync(locDir, { recursive: true });

    const graphPath = path.join(locDir, 'unit-graph.json');
    const docGraphPath = path.join(locDir, 'doc-graph.json');
    const hadGraph = fs.existsSync(graphPath);
    const hadDocGraph = fs.existsSync(docGraphPath);

    writeJson(path.join(locDir, 'topics.json'), topicsFile);
    writeJson(path.join(locDir, 'term-topics.json'), termTopicsFile);
    ensureCompanions(locDir, locale);
    updateLocaleManifest(locDir, locale, topics.length, sourceNote);
    updateRootSearchManifest(searchRoot, locale);

    if (hadGraph && !fs.existsSync(graphPath)) {
      throw new Error(`unit-graph.json was removed under ${locDir}`);
    }
    if (hadDocGraph && !fs.existsSync(docGraphPath)) {
      throw new Error(`doc-graph.json was removed under ${locDir}`);
    }
    if (hadGraph) {
      // touch-check only; do not rewrite
      const st = fs.statSync(graphPath);
      if (st.size < 10) {
        console.warn(`warning: unit-graph.json looks empty at ${graphPath}`);
      }
    }

    console.log(
      `wrote ${path.relative(REPO, locDir)} topics=${topics.length} terms=${termCount}` +
        (hadGraph ? ' (graph preserved)' : ' (no graph yet)'),
    );
  }
}

main();
