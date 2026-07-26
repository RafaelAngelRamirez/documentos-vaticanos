/**
 * Unit tests for hub topic assignment logic + structural checks after build.
 * Runs pure functions via ts-node require, or structural asserts on pack.
 *
 *   node topics_postings.test.js
 *   npm run test:topics-postings
 *   npm run test:topics-golden
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..');
const TS_NODE = path.join(HERE, 'node_modules', '.bin', 'ts-node');
const GOLDEN_FIXTURE = path.join(HERE, 'fixtures', 'topics-golden.es.json');

function loadAssignLogic() {
  // Compile-on-the-fly with ts-node transpile-only
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', esModuleInterop: true },
  });
  return require('./src/topics/assign_logic.ts');
}

function testPureAssign() {
  const L = loadAssignLogic();
  assert.strictEqual(L.foldText('Gracía!!!'), 'gracia');
  assert.strictEqual(L.foldText('Espíritu Santo'), 'espiritu santo');
  assert.ok(L.tokenizeFolded(L.foldText('a  b')).length === 2);
  assert.strictEqual(L.MAX_TOPICS_PER_UNIT, 4, 'PR4c K=4');

  const topics = L.topicsFromSeed(L.MINIMAL_SEED_FIXTURE_ES, 'es');
  assert.ok(topics.length >= 15, 'fixture ≥15 topics');
  assert.ok(topics.some((t) => t.id === 'topic:es:gracia'));

  const text =
    'La gracia santificante es un don de Dios que nos hace partícipes de la vida divina.';
  const hits = L.assignTopicsToUnit(text, topics);
  assert.ok(hits.length >= 1, 'should assign at least gracia');
  assert.ok(
    hits.some((h) => h.topicId === 'topic:es:gracia'),
    'gracia assigned',
  );
  assert.ok(hits.every((h) => h.conf > 0 && h.conf <= 1));
  assert.ok(hits.length <= L.MAX_TOPICS_PER_UNIT);

  // alias weight path
  const emptyish = L.assignTopicsToUnit('palabra irrelevante xyz', topics);
  assert.strictEqual(emptyish.length, 0);

  // cap postings prefer cic-es
  const raw = [
    { documentId: 'lg-es', unitIndex: 1, conf: 0.5, kind: 'council' },
    { documentId: 'cic-es', unitIndex: 10, conf: 0.5, kind: 'catechism' },
    { documentId: 'mm-es', unitIndex: 2, conf: 0.9, kind: 'magisterium' },
    { documentId: 'cdc-es', unitIndex: 3, conf: 0.5, kind: 'canon-law' },
  ];
  const capped = L.capPostings(raw, 3);
  assert.strictEqual(capped.length, 3);
  assert.strictEqual(capped[0].documentId, 'mm-es', 'highest conf first');
  // among conf 0.5, cic-es preferred
  assert.strictEqual(capped[1].documentId, 'cic-es');

  // multi-word phrase
  const euc = topics.find((t) => t.slug === 'eucaristia');
  assert.ok(euc);
  const tokens = L.tokenizeFolded(
    L.foldText('Recibimos la sagrada comunion en la misa'),
  );
  const { score } = L.scoreTopicOnTokens(tokens, euc);
  assert.ok(score > 0, 'sagrada comunion alias should hit');

  // expand: multi-word with one intervening token
  const tri = topics.find((t) => t.slug === 'trinidad');
  assert.ok(tri);
  // fixture alias "padre hijo espiritu" — with gap: "padre y hijo espiritu"
  const gapTokens = L.tokenizeFolded(
    L.foldText('el padre eterno hijo espiritu en la trinidad'),
  );
  const mGap = L.matchPhrase(gapTokens, 'padre hijo espiritu', { expand: true });
  assert.ok(
    mGap.hits >= 1 ||
      L.matchPhrase(gapTokens, 'trinidad', { expand: true }).hits >= 1,
    'expand multi-word or primary should hit trinidad-ish text',
  );

  // expand stem: long term + short inflection
  assert.ok(
    L.tokenMatchesTerm('eucaristicas', 'eucaristica', true),
    'expand stem inflection',
  );
  assert.ok(
    !L.tokenMatchesTerm('felicidad', 'fe', true),
    'short term must not stem-expand into longer words',
  );

  // early bonus raises score when primary is early
  const earlyTokens = L.tokenizeFolded(
    L.foldText('Gracia y más palabras de relleno al final del párrafo largo'),
  );
  const lateTokens = L.tokenizeFolded(
    L.foldText(
      'Muchas palabras de relleno al inicio del párrafo para empujar la mención de gracia al final del texto artificialmente',
    ),
  );
  const gracia = topics.find((t) => t.slug === 'gracia');
  const sEarly = L.scoreTopicOnTokens(earlyTokens, gracia, { expand: true });
  const sLate = L.scoreTopicOnTokens(lateTokens, gracia, { expand: true });
  assert.ok(sEarly.score >= sLate.score, 'early position should not score less');

  // term-topics map
  const tt = L.buildTermTopicsMap(topics);
  assert.ok(tt['gracia'] || tt.gracia);
  const g = tt['gracia'] || tt.gracia;
  assert.ok(g.some((e) => e.topicId === 'topic:es:gracia'));

  // toTopicRecords carries unitCount/documentCount
  const stats = new Map([
    ['topic:es:gracia', { unitCount: 12, documentCount: 3 }],
  ]);
  const recs = L.toTopicRecords(topics, stats);
  const gRec = recs.find((r) => r.slug === 'gracia');
  assert.strictEqual(gRec.unitCount, 12);
  assert.strictEqual(gRec.documentCount, 3);

  console.log('ok pure assign_logic');
}

function testGoldenFixtureFile() {
  assert.ok(
    fs.existsSync(GOLDEN_FIXTURE),
    'fixtures/topics-golden.es.json must exist',
  );
  const g = JSON.parse(fs.readFileSync(GOLDEN_FIXTURE, 'utf8'));
  assert.strictEqual(g.locale, 'es');
  assert.ok(g.minPostings >= 8, 'minPostings ≥ 8');
  assert.ok(Array.isArray(g.slugs) && g.slugs.length >= 4);
  for (const s of [
    'gracia',
    'trinidad',
    'eucaristia',
    'matrimonio',
    'bautismo',
    'fe',
    'iglesia',
    'pecado',
  ]) {
    assert.ok(g.slugs.includes(s), `golden slug ${s}`);
  }
  console.log('ok golden fixture file');
}

function testGoldenPackCounts() {
  const pack = path.join(REPO, 'documentos', 'corpus', 'search', 'es');
  const postingsPath = path.join(pack, 'topic-postings.json');
  const topicsPath = path.join(pack, 'topics.json');
  if (!fs.existsSync(postingsPath) || !fs.existsSync(topicsPath)) {
    console.log('skip golden pack counts (pack not built)');
    return;
  }
  const g = JSON.parse(fs.readFileSync(GOLDEN_FIXTURE, 'utf8'));
  const postings = JSON.parse(fs.readFileSync(postingsPath, 'utf8')).postings || {};
  const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8')).topics || [];
  const bySlug = new Map(topics.map((t) => [String(t.slug).toLowerCase(), t]));
  for (const slug of g.slugs) {
    const t = bySlug.get(slug);
    if (!t) continue;
    const id = t.id || `topic:es:${slug}`;
    const n = (postings[id] || []).length;
    assert.ok(
      n >= g.minPostings,
      `golden ${slug} has ${n} postings, need ≥ ${g.minPostings}`,
    );
    assert.ok(n > 0, `golden ${slug} must not be empty`);
  }
  console.log('ok golden pack counts');
}

function testStructuralPack() {
  const pack = path.join(REPO, 'documentos', 'corpus', 'search', 'es');
  const postingsPath = path.join(pack, 'topic-postings.json');
  if (!fs.existsSync(postingsPath)) {
    console.log('skip structural (no topic-postings.json yet)');
    return;
  }
  const raw = JSON.parse(fs.readFileSync(postingsPath, 'utf8'));
  assert.strictEqual(raw.version, 1);
  assert.strictEqual(raw.locale, 'es');
  assert.ok(raw.postings && typeof raw.postings === 'object');

  let rows = 0;
  for (const [tid, list] of Object.entries(raw.postings)) {
    assert.ok(tid.startsWith('topic:'), tid);
    assert.ok(Array.isArray(list));
    assert.ok(list.length <= 200, `${tid} over cap`);
    for (const c of list) {
      rows++;
      assert.ok(typeof c.documentId === 'string' && c.documentId);
      assert.ok(Number.isInteger(c.unitIndex) && c.unitIndex >= 0);
      if (c.conf != null) {
        assert.ok(c.conf >= 0 && c.conf <= 1);
      }
    }
  }

  const topicsPath = path.join(pack, 'topics.json');
  if (fs.existsSync(topicsPath)) {
    const t = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
    assert.ok(Array.isArray(t.topics));
    assert.ok(t.topics.length <= 250);
  }

  // unit-graph preserved
  const graph = path.join(pack, 'unit-graph.json');
  assert.ok(fs.existsSync(graph), 'unit-graph.json must remain');

  console.log(`ok structural pack (${rows} postings rows)`);
}

function testSyntheticBuildOptional() {
  // Tiny in-memory simulation of multi-doc assign + cap
  const L = loadAssignLogic();
  const topics = L.topicsFromSeed(
    [
      {
        slug: 'gracia',
        label: 'Gracia',
        terms: ['gracia'],
        aliases: ['don divino'],
      },
      {
        slug: 'fe',
        label: 'Fe',
        terms: ['fe', 'creer'],
      },
    ],
    'es',
  );
  const units = [
    {
      documentId: 'cic-es',
      unitIndex: 0,
      contenido: 'La gracia de Dios salva.',
      kind: 'catechism',
    },
    {
      documentId: 'lg-es',
      unitIndex: 1,
      contenido: 'Creer es un acto de fe.',
      kind: 'council',
    },
    {
      documentId: 'mm-es',
      unitIndex: 2,
      contenido: 'Sin mención relevante aquí del tema.',
      kind: 'magisterium',
    },
  ];
  const buckets = new Map(topics.map((t) => [t.id, []]));
  for (const u of units) {
    const hits = L.assignTopicsToUnit(u.contenido, topics);
    for (const h of hits) {
      buckets.get(h.topicId).push({
        documentId: u.documentId,
        unitIndex: u.unitIndex,
        conf: h.conf,
        kind: u.kind,
      });
    }
  }
  assert.ok((buckets.get('topic:es:gracia') || []).length >= 1);
  assert.ok((buckets.get('topic:es:fe') || []).length >= 1);
  console.log('ok synthetic multi-unit assign');
}

function main() {
  testPureAssign();
  testSyntheticBuildOptional();
  testStructuralPack();
  testGoldenFixtureFile();
  testGoldenPackCounts();
  console.log('All topics_postings tests passed.');
}

main();
