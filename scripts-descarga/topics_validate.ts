/**
 * Validate topic-search pack under search/{locale}/.
 *
 * Asserts:
 *   - topics ≤ 250
 *   - each postings list ≤ 200
 *   - total raw size of search/{locale}/*.json ≤ 12_000_000
 *   - every posting documentId non-empty, unitIndex non-negative int
 * Soft (warn): golden topics gracia, trinidad, eucaristia, matrimonio have ≥3
 * postings when those topics exist.
 *
 * Usage:
 *   npx ts-node --transpile-only topics_validate.ts --locale es
 *   npm run topics:validate -- --locale es
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

const GOLDEN_SLUGS = ['gracia', 'trinidad', 'eucaristia', 'matrimonio'];

function parseArgs(argv: string[]) {
  let locale = 'es';
  let strictGolden = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--locale' && argv[i + 1]) locale = argv[++i];
    else if (a === '--strict-golden') strictGolden = true;
    else if (a === '--help') {
      console.log(
        `Usage: topics_validate.ts [--locale es] [--strict-golden]`,
      );
      process.exit(0);
    }
  }
  return { locale, strictGolden };
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
  const { locale, strictGolden } = parseArgs(process.argv.slice(2));
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
  let topics: Array<{ id?: string; slug?: string }> = [];
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

  // golden soft check
  const topicBySlug = new Map<string, string>();
  for (const t of topics) {
    if (t.slug) topicBySlug.set(String(t.slug), t.id || `topic:${locale}:${t.slug}`);
  }
  for (const slug of GOLDEN_SLUGS) {
    const id =
      topicBySlug.get(slug) ||
      Object.keys(postings).find((k) => k.endsWith(`:${slug}`));
    if (!id) continue;
    const n = postings[id]?.length ?? 0;
    if (n < 3) {
      const msg = `golden topic ${slug} (${id}) has ${n} postings (<3)`;
      if (strictGolden) errors.push(msg);
      else warnings.push(msg);
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
