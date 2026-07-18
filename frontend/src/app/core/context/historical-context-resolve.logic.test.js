/**
 * Real resolve tests against shipped historical-context-resolve.logic.ts + pack.
 *
 * Run:
 *   bash scripts/node-strip-types.sh frontend/src/app/core/context/historical-context-resolve.logic.test.js
 *   (or: yarn test:context)
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../../');
const LOGIC = path.join(HERE, 'historical-context-resolve.logic.ts');
const PACK = path.join(REPO, 'frontend/src/assets/corpus/context/manifest.json');
const PACK_DOCS = path.join(REPO, 'frontend/src/assets/corpus/context/documents');
const PACK_AUTH = path.join(REPO, 'frontend/src/assets/corpus/context/authors');
const CORPUS = path.join(REPO, 'frontend/src/assets/corpus/manifest.json');
const CORPUS_CANON = path.join(REPO, 'documentos/corpus/manifest.json');

function loadCorpusIds() {
  const paths = [CORPUS, CORPUS_CANON].filter((p) => fs.existsSync(p));
  assert.ok(paths.length, 'missing corpus manifest');
  let best = { documents: [] };
  for (const p of paths) {
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    if ((m.documents || []).length > (best.documents || []).length) best = m;
  }
  return (best.documents || []).map((d) => d.id);
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  assert.ok(fs.existsSync(LOGIC), `missing ${LOGIC}`);
  assert.ok(fs.existsSync(PACK), `missing context pack ${PACK}`);

  const logic = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  assert.strictEqual(
    logic.HISTORICAL_CONTEXT_MANIFEST_URL,
    'assets/corpus/context/manifest.json',
  );

  const pack = loadJson(PACK);
  const corpusIds = loadCorpusIds();
  assert.ok(corpusIds.length >= 100, `expected large corpus, got ${corpusIds.length}`);

  const packDocIds = new Set((pack.documents || []).map((d) => d.documentId));
  const missing = corpusIds.filter((id) => !packDocIds.has(id));
  assert.strictEqual(
    missing.length,
    0,
    `context pack missing docs: ${missing.slice(0, 8).join(',')}`,
  );

  // Coverage: every document resolves with 8 axes + ≥1 reference
  let incomplete = [];
  for (const id of corpusIds) {
    const entry = pack.documents.find((d) => d.documentId === id);
    const overlay = loadJson(path.join(PACK_DOCS, `${id}.json`));
    let author = null;
    if (entry.authorProfileId) {
      const ap = path.join(PACK_AUTH, `${entry.authorProfileId}.json`);
      assert.ok(fs.existsSync(ap), `missing author ${entry.authorProfileId}`);
      author = loadJson(ap);
    }
    const resolved = logic.resolveHistoricalContext(id, overlay, author);
    if (!logic.isCoverageComplete(resolved)) {
      incomplete.push(id);
    }
  }
  assert.strictEqual(
    incomplete.length,
    0,
    `incomplete axes/refs: ${incomplete.slice(0, 10).join(',')}`,
  );

  // Multi-obra Agustín: general shared, chronology distinct
  const conf = loadJson(path.join(PACK_DOCS, 'agustin-02-confesiones-es.json'));
  const cdd = loadJson(path.join(PACK_DOCS, 'agustin-16-ciudad-de-dios-1-es.json'));
  const agAuthor = loadJson(path.join(PACK_AUTH, 'agustin-hipona.json'));
  const rConf = logic.resolveHistoricalContext(
    'agustin-02-confesiones-es',
    conf,
    agAuthor,
  );
  const rCdd = logic.resolveHistoricalContext(
    'agustin-16-ciudad-de-dios-1-es',
    cdd,
    agAuthor,
  );
  assert.ok(rConf && rCdd);
  assert.strictEqual(rConf.generalSummary, rCdd.generalSummary);
  assert.ok(rConf.generalSummary && rConf.generalSummary.length > 40);
  assert.notStrictEqual(
    rConf.chronologyNote,
    rCdd.chronologyNote,
    'chronology must differ between Confesiones and Ciudad de Dios',
  );
  assert.notStrictEqual(
    rConf.compositionYears,
    rCdd.compositionYears,
    'composition years must differ',
  );
  assert.notStrictEqual(
    (rConf.workSummary || '').slice(0, 40),
    (rCdd.workSummary || '').slice(0, 40),
  );

  // Sample kinds + dense citations
  for (const sample of ['cic-es', 'nicea-i-es', 'dv-es']) {
    const o = loadJson(path.join(PACK_DOCS, `${sample}.json`));
    const a = o.authorProfileId
      ? loadJson(path.join(PACK_AUTH, `${o.authorProfileId}.json`))
      : null;
    const r = logic.resolveHistoricalContext(sample, o, a);
    assert.ok(logic.isCoverageComplete(r), `sample ${sample} incomplete`);
    assert.ok(
      logic.hasDenseCitations(r),
      `sample ${sample} missing dense per-axis/paragraph citations`,
    );
  }

  assert.ok(logic.hasDenseCitations(rConf), 'confesiones dense citations');
  assert.ok(logic.hasDenseCitations(rCdd), 'ciudad de dios dense citations');
  assert.ok(
    (rConf.summaryRefIds || []).length >= 1,
    'summaryRefIds on resolved',
  );
  assert.ok(
    (rConf.workSummaryRefIds || []).length >= 1,
    'workSummaryRefIds on resolved',
  );
  assert.ok(
    (rConf.axisSources?.lugar || []).length >= 1,
    'axisSources.lugar present',
  );
  // confesiones work sources should prefer primary text ids
  assert.ok(
    (rConf.workSummaryRefIds || []).some((id) =>
      /aug-conf|brown|ce-augustine|conf/i.test(id),
    ),
    `confesiones work refs unexpected: ${(rConf.workSummaryRefIds || []).join(',')}`,
  );

  // axisRowsForUi with sources
  const rows = logic.axisRowsForUi(
    rConf.axes,
    logic.CONTEXT_AXIS_LABELS,
    rConf.axisSources,
    rConf.references,
  );
  assert.strictEqual(rows.length, 8);
  assert.ok(rows.every((row) => row.sources && row.sources.length >= 1));

  const order = logic.orderedRefIds(rConf);
  assert.ok(order.length >= 3, 'ordered bibliography ids');
  assert.ok(logic.sourceMarkers(rConf.summaryRefIds, order).startsWith('['));

  // Dense gate over full corpus
  let notDense = [];
  for (const id of corpusIds) {
    const entry = pack.documents.find((d) => d.documentId === id);
    const overlay = loadJson(path.join(PACK_DOCS, `${id}.json`));
    const author = entry.authorProfileId
      ? loadJson(path.join(PACK_AUTH, `${entry.authorProfileId}.json`))
      : null;
    const resolved = logic.resolveHistoricalContext(id, overlay, author);
    if (!logic.hasDenseCitations(resolved)) notDense.push(id);
  }
  assert.strictEqual(
    notDense.length,
    0,
    `not dense: ${notDense.slice(0, 12).join(',')}`,
  );

  // Speakable text for in-ficha narrator (bio/context voice path)
  const chunks = logic.speakableHistoricalContextChunks(rConf);
  assert.ok(chunks.length >= 3, `expected several speak chunks, got ${chunks.length}`);
  assert.ok(
    chunks.some((c) => /obra|confesion|agustín|lugar/i.test(c)),
    'chunks should include contextual prose',
  );
  const joined = logic.speakableHistoricalContext(rConf);
  assert.ok(joined.length > 80);
  assert.deepStrictEqual(logic.speakableHistoricalContextChunks(null), []);

  // null-safe
  assert.strictEqual(logic.resolveHistoricalContext('x', null, null), null);
  assert.strictEqual(logic.isCoverageComplete(null), false);
  assert.strictEqual(logic.hasDenseCitations(null), false);

  console.log('ok historical-context-resolve');
  console.log(
    JSON.stringify({
      corpus: corpusIds.length,
      packDocs: pack.documents.length,
      authors: pack.authors.length,
      incomplete: 0,
      notDense: 0,
      agustinChronologyDiff: true,
      denseCitations: true,
      samples: ['cic-es', 'nicea-i-es', 'dv-es', 'agustin-02-confesiones-es'],
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
