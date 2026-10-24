/**
 * PR4a seed ontology checks (plain node).
 * Run: node scripts-descarga/topics_seed.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SEED = path.join(
  REPO,
  'scripts-descarga',
  'config',
  'topics-seed.es.json',
);
const ROOTS = [
  path.join(REPO, 'documentos', 'corpus', 'search', 'es'),
  path.join(REPO, 'frontend', 'src', 'assets', 'corpus', 'search', 'es'),
];

function main() {
  assert.ok(fs.existsSync(SEED), `missing seed ${SEED}`);
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  assert.strictEqual(seed.locale, 'es');
  assert.ok(Array.isArray(seed.topics), 'seed.topics array');
  const n = seed.topics.length;
  assert.ok(n >= 80 && n <= 250, `topic count ${n} not in [80,250]`);

  const slugs = seed.topics.map((t) => t.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length, 'unique slugs');
  for (const slug of slugs) {
    assert.ok(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
      `bad slug ${slug}`,
    );
  }

  for (const root of ROOTS) {
    const topicsPath = path.join(root, 'topics.json');
    const termsPath = path.join(root, 'term-topics.json');
    const graphPath = path.join(root, 'unit-graph.json');
    const manPath = path.join(root, 'manifest.json');

    assert.ok(fs.existsSync(topicsPath), `missing ${topicsPath}`);
    assert.ok(fs.existsSync(termsPath), `missing ${termsPath}`);
    assert.ok(fs.existsSync(graphPath), `graph must remain ${graphPath}`);
    assert.ok(fs.statSync(graphPath).size > 1000, 'unit-graph non-trivial');

    const topicsFile = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
    const topics = topicsFile.topics || topicsFile;
    assert.ok(Array.isArray(topics), 'topics array');
    assert.ok(topics.length >= 80 && topics.length <= 250);

    const ids = topics.map((t) => t.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'unique topic ids');
    for (const t of topics) {
      assert.ok(t.id.startsWith('topic:es:'), `id ${t.id}`);
      assert.strictEqual(t.kind, 'seed');
      assert.ok(t.slug && t.label);
    }

    const termFile = JSON.parse(fs.readFileSync(termsPath, 'utf8'));
    assert.strictEqual(termFile.locale, 'es');
    assert.ok(termFile.terms && typeof termFile.terms === 'object');
    const idSet = new Set(ids);
    let termCount = 0;
    for (const [term, list] of Object.entries(termFile.terms)) {
      termCount++;
      assert.ok(Array.isArray(list), `term list ${term}`);
      for (const e of list) {
        assert.ok(idSet.has(e.topicId), `orphan term ${term} → ${e.topicId}`);
        assert.ok(typeof e.w === 'number' && e.w > 0 && e.w <= 1);
      }
    }
    assert.ok(termCount >= 50, `expected many terms, got ${termCount}`);

    const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
    assert.strictEqual(man.topicCount, topics.length);
    assert.ok(man.files && man.files.topics && man.files.termTopics);
    assert.ok(man.files.graph, 'manifest keeps graph');
    assert.ok(man.generatedAt, 'generatedAt set');
  }

  // dual-write parity
  const a = JSON.parse(fs.readFileSync(path.join(ROOTS[0], 'topics.json'), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.join(ROOTS[1], 'topics.json'), 'utf8'));
  assert.strictEqual(
    JSON.stringify(a),
    JSON.stringify(b),
    'topics dual-write match',
  );
  const ta = JSON.parse(
    fs.readFileSync(path.join(ROOTS[0], 'term-topics.json'), 'utf8'),
  );
  const tb = JSON.parse(
    fs.readFileSync(path.join(ROOTS[1], 'term-topics.json'), 'utf8'),
  );
  assert.strictEqual(
    JSON.stringify(ta),
    JSON.stringify(tb),
    'term-topics dual-write match',
  );

  console.log(
    `topics_seed.test.js OK — ${n} seed topics, dual roots + graph preserved`,
  );
}

main();
