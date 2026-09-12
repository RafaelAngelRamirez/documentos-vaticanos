/**
 * Pure topic-query helpers (parse, term→topic, soft boost, postings rank).
 * Run: bash scripts/node-strip-types.sh frontend/src/app/core/search/topic-query.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const Q = require('./topic-query.logic.ts');
const BUSCADOR_TS = path.resolve(
  HERE,
  '../../components/buscador/buscador.component.ts',
);
const BUSCAR_PAGE_TS = path.resolve(HERE, '../../pages/buscar/buscar.component.ts');

function section(name) {
  console.log(`\n== ${name} ==`);
}

function samplePack() {
  return {
    manifest: { locale: 'es' },
    topics: [
      {
        id: 'topic:es:gracia',
        slug: 'gracia',
        label: 'Gracia',
        aliases: ['gracia divina'],
        kind: 'seed',
      },
      {
        id: 'topic:es:amor',
        slug: 'amor',
        label: 'Amor',
        kind: 'seed',
      },
    ],
    postings: {
      postings: {
        'topic:es:gracia': [
          { documentId: 'cic-es', unitIndex: 10, conf: 0.9, consecutivo: '1996' },
          { documentId: 'cic-es', unitIndex: 11, conf: 0.5, consecutivo: '1997' },
          { documentId: 'lg-es', unitIndex: 2, conf: 0.8 },
        ],
        'topic:es:amor': [
          { documentId: 'cic-es', unitIndex: 20, conf: 0.7 },
        ],
      },
    },
    termTopics: {
      terms: {
        gracia: [{ topicId: 'topic:es:gracia', w: 1 }],
        amor: [{ topicId: 'topic:es:amor', w: 0.9 }],
        dios: [
          { topicId: 'topic:es:amor', w: 0.4 },
          { topicId: 'topic:es:gracia', w: 0.3 },
        ],
      },
    },
  };
}

function main() {
  section('foldTopicTerm');
  assert.strictEqual(Q.foldTopicTerm('Gracia'), 'gracia');
  assert.strictEqual(Q.foldTopicTerm('  ÁMOR  '), 'amor');
  assert.ok(Q.foldTopicTerm('niño').includes('n')); // ñ kept path
  console.log('  fold OK');

  section('parseTopicQuery');
  assert.deepStrictEqual(Q.parseTopicQuery('el amor de Dios'), {
    mode: 'lexical',
    slug: null,
    lexicalRaw: 'el amor de Dios',
  });
  assert.deepStrictEqual(Q.parseTopicQuery('tema:gracia'), {
    mode: 'topic',
    slug: 'gracia',
    lexicalRaw: '',
  });
  assert.deepStrictEqual(Q.parseTopicQuery('topic: amor '), {
    mode: 'topic',
    slug: 'amor',
    lexicalRaw: '',
  });
  assert.deepStrictEqual(
    Q.parseTopicQuery('x', { mode: 'topic', slug: 'gracia' }),
    { mode: 'topic', slug: 'gracia', lexicalRaw: 'x' },
  );
  assert.deepStrictEqual(
    Q.parseTopicQuery('gracia', { mode: 'topic' }),
    { mode: 'topic', slug: 'gracia', lexicalRaw: '' },
  );
  assert.deepStrictEqual(
    Q.parseTopicQuery(null, { mode: 'topic', topic: 'topic:es:gracia' }),
    { mode: 'topic', slug: 'topic:es:gracia', lexicalRaw: '' },
  );
  console.log('  parse OK');

  section('topicIdsFromContentTerms');
  const pack = samplePack();
  const ids = Q.topicIdsFromContentTerms(['gracia', 'dios'], pack.termTopics);
  assert.ok(ids.includes('topic:es:gracia'));
  assert.ok(ids.includes('topic:es:amor'));
  assert.strictEqual(
    Q.topicIdsFromContentTerms(['nada'], pack.termTopics).length,
    0,
  );
  assert.strictEqual(
    Q.topicIdsFromContentTerms(['gracia'], { terms: {} }).length,
    0,
  );
  // diacritic fold on map keys
  const idsFold = Q.topicIdsFromContentTerms(['Grácia'], {
    terms: { gracia: [{ topicId: 'topic:es:gracia', w: 1 }] },
  });
  assert.deepStrictEqual(idsFold, ['topic:es:gracia']);
  const phraseIds = Q.topicIdsFromContentTerms(['amor', 'dios'], {
    terms: {
      amor: [{ topicId: 'topic:es:amor', w: 0.5 }],
      'amor dios': [{ topicId: 'topic:es:amor', w: 0.9 }],
    },
  });
  assert.ok(phraseIds[0] === 'topic:es:amor', 'phrase key ranks');
  console.log('  term→topic OK');

  section('applyTopicBoostIfAny soft-empty');
  const hits = [
    {
      documentId: 'cic-es',
      unitIndex: 10,
      score: 1,
      matchedTerms: ['gracia'],
      highlightTerms: ['gracia'],
    },
    {
      documentId: 'cic-es',
      unitIndex: 99,
      score: 1.2,
      matchedTerms: [],
      highlightTerms: [],
    },
  ];
  const emptyBoost = Q.applyTopicBoostIfAny(hits, null, ['gracia']);
  assert.strictEqual(emptyBoost.boosted, false);
  assert.strictEqual(emptyBoost.hits[1].score, 1.2);

  const emptyPackBoost = Q.applyTopicBoostIfAny(
    hits,
    {
      topics: [],
      postings: { postings: {} },
      termTopics: { terms: {} },
    },
    ['gracia'],
  );
  assert.strictEqual(emptyPackBoost.boosted, false);

  const boosted = Q.applyTopicBoostIfAny(hits, pack, ['gracia']);
  assert.strictEqual(boosted.boosted, true);
  assert.ok(boosted.topicIds.includes('topic:es:gracia'));
  const h10 = boosted.hits.find((h) => h.unitIndex === 10);
  const h99 = boosted.hits.find((h) => h.unitIndex === 99);
  assert.ok(h10.score > 1, 'membership should raise score');
  assert.strictEqual(h99.score, 1.2, 'non-member unchanged');
  assert.ok(
    boosted.hits[0].unitIndex === 10 || boosted.hits[0].score >= h99.score,
    'boosted hit ranks first or ties higher score path',
  );
  console.log('  boost OK');

  section('hitsFromTopicPostings');
  const topicHits = Q.hitsFromTopicPostings(pack, 'gracia', 10);
  assert.strictEqual(topicHits.length, 3);
  assert.strictEqual(topicHits[0].documentId, 'cic-es');
  assert.strictEqual(topicHits[0].unitIndex, 10);
  assert.ok(topicHits[0].score >= topicHits[1].score);
  assert.deepStrictEqual(
    Q.hitsFromTopicPostings(pack, 'no-existe', 10),
    [],
  );
  assert.deepStrictEqual(Q.hitsFromTopicPostings(null, 'gracia'), []);
  // empty postings soft degrade
  assert.deepStrictEqual(
    Q.hitsFromTopicPostings(
      {
        ...pack,
        postings: { postings: {} },
      },
      'gracia',
    ),
    [],
  );
  console.log('  postings rank OK');

  section('findTopicInPack');
  assert.strictEqual(Q.findTopicInPack(pack, 'gracia')?.id, 'topic:es:gracia');
  assert.strictEqual(
    Q.findTopicInPack(pack, 'topic:es:amor')?.slug,
    'amor',
  );
  assert.strictEqual(Q.findTopicInPack(pack, 'gracia divina')?.slug, 'gracia');
  console.log('  find OK');

  section('packHasTopicSignals');
  assert.strictEqual(Q.packHasTopicSignals(pack), true);
  assert.strictEqual(
    Q.packHasTopicSignals({
      topics: [],
      postings: { postings: {} },
      termTopics: { terms: {} },
    }),
    false,
  );
  console.log('  signals OK');

  section('buscador / buscar wiring (structural)');
  assert.ok(fs.existsSync(BUSCADOR_TS), 'buscador.component.ts');
  const busSrc = fs.readFileSync(BUSCADOR_TS, 'utf8');
  assert.ok(busSrc.includes('TopicIndexService'), 'Buscador injects TopicIndexService');
  assert.ok(
    busSrc.includes('applyTopicBoostIfAny') || busSrc.includes('topic-query.logic'),
    'Buscador uses topic-query helpers',
  );
  assert.ok(!/\bensureAllLoaded\b/.test(busSrc), 'no ensureAllLoaded');

  assert.ok(fs.existsSync(BUSCAR_PAGE_TS), 'buscar.component.ts');
  const pageSrc = fs.readFileSync(BUSCAR_PAGE_TS, 'utf8');
  assert.ok(
    pageSrc.includes('mode') && (pageSrc.includes('slug') || pageSrc.includes('topic')),
    'buscar page reads mode/slug topic params',
  );
  console.log('  wiring OK');

  console.log('\nAll topic-query tests passed.');
}

main();
