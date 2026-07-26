/**
 * Validate topic-search pack under search/{locale}/.
 *
 * Asserts:
 *   - topics ≤ 250
 *   - each postings list ≤ 200
 *   - total raw size of search/{locale}/*.json ≤ 12_000_000
 *   - every posting documentId non-empty, unitIndex non-negative int
 * Golden (fixture fixtures/topics-golden.es.json):
 *   - Strict by default (CI): each existing golden slug ≥ minPostings (8)
 *   - Soft mode: --soft-golden (warn instead of error when below min, but
 *     still error if golden exists with 0 postings)
 * Dual-write roots: optional size parity warn
 *
 * Usage:
 *   npx ts-node --transpile-only topics_validate.ts --locale es
 *   npm run topics:validate -- --locale es
 *   npm run topics:validate -- --locale es --soft-golden
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  TOPIC_PACK_CAPS_V1,
} from './models/topic-pack.model';

const REPO = path.resolve(__dirname, '..');
const CORPUS_ROOTS = [
  path.join(REPO, 'documentos', 'corpus'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus'),
];

const DEFAULT_GOLDEN = path.join(
  __dirname,
  'fixtures',
  'topics-golden.es.json',
);

/** Fallback if fixture file is missing. */
const FALLBACK_GOLDEN_SLUGS = [
  'gracia',
  'trinidad',
  'eucaristia',
  'matrimonio',
  'bautismo',
  'fe',
  'iglesia',
  'pecado',
];
const FALLBACK_MIN_POSTINGS = 8;

interface GoldenFixture {
  locale?: string;
  minPostings?: number;
  slugs?: string[];
}

function parseArgs(argv: string[]) {
  let locale = 'es';
  /** Strict golden is default for CI (PR4c). */
  let softGolden = false;
  let goldenPath = DEFAULT_GOLDEN;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--locale' && argv[i + 1]) locale = argv[++i];
    else if (a === '--soft-golden') softGolden = true;
    else if (a === '--strict-golden') softGolden = false;
    else if (a === '--golden' && argv[i + 1])
      goldenPath = path.resolve(argv[++i]);
    else if (a === '--help') {
      console.log(
        `Usage: topics_validate.ts [--locale es] [--soft-golden] [--strict-golden] [--golden path]`,
      );
      process.exit(0);
    }
  }
  return { locale, softGolden, goldenPath };
}

function loadGolden(goldenPath: string, locale: string): {
  minPostings: number;
  slugs: string[];
  source: string;
} {
  if (fs.existsSync(goldenPath)) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(goldenPath, 'utf8'),
      ) as GoldenFixture;
      const slugs = Array.isArray(raw.slugs)
        ? raw.slugs.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
        : FALLBACK_GOLDEN_SLUGS;
      const minPostings =
        typeof raw.minPostings === 'number' && raw.minPostings > 0
          ? raw.minPostings
          : FALLBACK_MIN_POSTINGS;
      if (raw.locale && raw.locale !== locale) {
        console.warn(
          `golden fixture locale ${raw.locale} != --locale ${locale}; still applying slugs`,
        );
      }
      return {
        minPostings,
        slugs,
        source: path.relative(REPO, goldenPath),
      };
    } catch (e) {
      console.warn(`Failed to parse golden fixture ${goldenPath}`, e);
    }
  }
  return {
    minPostings: FALLBACK_MIN_POSTINGS,
    slugs: FALLBACK_GOLDEN_SLUGS,
    source: 'fallback',
  };
}

function dirSizeJson(dir: string): { total: number; files: Record<string, number> } {
  const files: Record<string, number> = {};
  let total = 0;
  if (!fs.existsSync(dir)) return { total: 0, files };
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (!st.isFile()) continue;
    files[name] = st.size;
    total += st.size;
  }
  return { total, files };
}

function main() {
  const { locale, softGolden, goldenPath } = parseArgs(process.argv.slice(2));
  const strictGolden = !softGolden;
  const golden = loadGolden(goldenPath, locale);
  const errors: string[] = [];
  const warnings: string[] = [];

  const primary = path.join(CORPUS_ROOTS[0], 'search', locale);
  if (!fs.existsSync(primary)) {
    console.error(`Missing pack dir ${primary}`);
    process.exit(1);
  }

  const caps = TOPIC_PACK_CAPS_V1;
  const size = dirSizeJson(primary);
  if (size.total > caps.maxRawBytes) {
    errors.push(
      `raw size ${size.total} > maxRawBytes ${caps.maxRawBytes} in ${primary}`,
    );
  }

  // topics
  const topicsPath = path.join(primary, 'topics.json');
  let topics: Array<{ id?: string; slug?: string; unitCount?: number }> = [];
  if (!fs.existsSync(topicsPath)) {
    errors.push(`missing topics.json`);
  } else {
    try {
      const raw = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
      topics = Array.isArray(raw?.topics) ? raw.topics : [];
      if (topics.length > caps.maxTopics) {
        errors.push(
          `topics count ${topics.length} > maxTopics ${caps.maxTopics}`,
        );
      }
    } catch (e) {
      errors.push(`topics.json parse error: ${e}`);
    }
  }

  // postings
  const postingsPath = path.join(primary, 'topic-postings.json');
  let postings: Record<
    string,
    Array<{ documentId?: string; unitIndex?: number; conf?: number }>
  > = {};
  if (!fs.existsSync(postingsPath)) {
    errors.push(`missing topic-postings.json`);
  } else {
    try {
      const raw = JSON.parse(fs.readFileSync(postingsPath, 'utf8'));
      if (raw?.version !== 1) {
        warnings.push(`topic-postings version is ${raw?.version}, expected 1`);
      }
      if (raw?.locale && raw.locale !== locale) {
        errors.push(
          `topic-postings locale ${raw.locale} != expected ${locale}`,
        );
      }
      postings =
        raw?.postings && typeof raw.postings === 'object' ? raw.postings : {};
    } catch (e) {
      errors.push(`topic-postings.json parse error: ${e}`);
    }
  }

  let postingRows = 0;
  for (const [topicId, list] of Object.entries(postings)) {
    if (!Array.isArray(list)) {
      errors.push(`postings[${topicId}] is not an array`);
      continue;
    }
    if (list.length > caps.maxPostingsPerTopic) {
      errors.push(
        `postings[${topicId}] length ${list.length} > ${caps.maxPostingsPerTopic}`,
      );
    }
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      postingRows++;
      if (!c || typeof c !== 'object') {
        errors.push(`postings[${topicId}][${i}] not object`);
        continue;
      }
      if (!c.documentId || typeof c.documentId !== 'string') {
        errors.push(`postings[${topicId}][${i}] bad documentId`);
      }
      const ui = c.unitIndex;
      if (
        typeof ui !== 'number' ||
        !Number.isInteger(ui) ||
        ui < 0 ||
        !Number.isFinite(ui)
      ) {
        errors.push(
          `postings[${topicId}][${i}] unitIndex must be non-negative int, got ${ui}`,
        );
      }
      if (c.conf != null) {
        const conf = Number(c.conf);
        if (!Number.isFinite(conf) || conf < 0 || conf > 1) {
          errors.push(
            `postings[${topicId}][${i}] conf out of range 0..1: ${c.conf}`,
          );
        }
      }
    }
  }

  // golden checks (fixture-driven)
  const topicBySlug = new Map<string, string>();
  for (const t of topics) {
    if (t.slug) {
      topicBySlug.set(
        String(t.slug).toLowerCase(),
        t.id || `topic:${locale}:${t.slug}`,
      );
    }
  }
  const goldenReport: Array<{
    slug: string;
    topicId: string | null;
    postings: number;
    status: 'ok' | 'missing_topic' | 'empty' | 'below_min';
  }> = [];

  for (const slug of golden.slugs) {
    const id =
      topicBySlug.get(slug) ||
      Object.keys(postings).find((k) => k.endsWith(`:${slug}`)) ||
      null;
    if (!id) {
      // Topic not in catalog — skip (not an error)
      goldenReport.push({
        slug,
        topicId: null,
        postings: 0,
        status: 'missing_topic',
      });
      continue;
    }
    const n = postings[id]?.length ?? 0;
    if (n === 0) {
      // Always hard error: golden exists but has 0 postings
      errors.push(
        `golden topic ${slug} (${id}) has 0 postings (must be ≥ ${golden.minPostings})`,
      );
      goldenReport.push({
        slug,
        topicId: id,
        postings: 0,
        status: 'empty',
      });
      continue;
    }
    if (n < golden.minPostings) {
      const msg = `golden topic ${slug} (${id}) has ${n} postings (<${golden.minPostings})`;
      if (strictGolden) errors.push(msg);
      else warnings.push(msg);
      goldenReport.push({
        slug,
        topicId: id,
        postings: n,
        status: 'below_min',
      });
    } else {
      goldenReport.push({
        slug,
        topicId: id,
        postings: n,
        status: 'ok',
      });
    }
  }

  // dual-write: assets pack exists and postings sizes match (soft)
  const assetsDir = path.join(CORPUS_ROOTS[1], 'search', locale);
  if (fs.existsSync(assetsDir)) {
    const aSize = dirSizeJson(assetsDir);
    if (Math.abs(aSize.total - size.total) > 64) {
      warnings.push(
        `assets search/${locale} size ${aSize.total} differs from documentos ${size.total}`,
      );
    }
  } else {
    warnings.push(`assets pack missing: ${assetsDir}`);
  }

  // unit-graph must not be required but if present should remain valid JSON
  const graphPath = path.join(primary, 'unit-graph.json');
  if (fs.existsSync(graphPath)) {
    try {
      JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    } catch {
      errors.push('unit-graph.json present but invalid JSON');
    }
  }

  const summary = {
    ok: errors.length === 0,
    locale,
    goldenMode: strictGolden ? 'strict' : 'soft',
    goldenSource: golden.source,
    goldenMinPostings: golden.minPostings,
    golden: goldenReport,
    topicCount: topics.length,
    postingTopics: Object.keys(postings).length,
    postingRows,
    rawBytes: size.total,
    maxRawBytes: caps.maxRawBytes,
    files: size.files,
    errors,
    warnings,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (errors.length) {
    process.exit(1);
  }
}

main();
