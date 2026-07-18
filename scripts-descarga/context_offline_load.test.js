/**
 * Offline pack load check (no network): dual-write + coverage invariants.
 *
 * Run: node scripts-descarga/context_offline_load.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const ROOTS = [
  path.join(REPO, 'documentos/corpus/context/manifest.json'),
  path.join(REPO, 'frontend/src/assets/corpus/context/manifest.json'),
];
const CORPUS = path.join(REPO, 'frontend/src/assets/corpus/manifest.json');
const AXES = [
  'lugar',
  'personajes',
  'gobierno',
  'cultura',
  'religion',
  'antropologia',
  'creenciasMundanas',
  'creenciaCristiana',
];

function main() {
  for (const file of ROOTS) {
    assert.ok(fs.existsSync(file), `missing ${file}`);
  }

  const a = JSON.parse(fs.readFileSync(ROOTS[0], 'utf8'));
  const b = JSON.parse(fs.readFileSync(ROOTS[1], 'utf8'));
  assert.strictEqual(
    a.documents.length,
    b.documents.length,
    'dual-write document count match',
  );
  assert.strictEqual(a.authors.length, b.authors.length, 'dual-write authors');

  const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
  const ids = (corpus.documents || []).map((d) => d.id);
  assert.ok(ids.length >= 1);

  const packIds = new Set(a.documents.map((d) => d.documentId));
  const missing = ids.filter((id) => !packIds.has(id));
  assert.strictEqual(missing.length, 0, `missing: ${missing.join(',')}`);

  const root = path.dirname(ROOTS[0]);
  let bad = 0;
  for (const entry of a.documents) {
    const overlay = JSON.parse(
      fs.readFileSync(path.join(root, entry.path), 'utf8'),
    );
    assert.strictEqual(overlay.documentId, entry.documentId);
    let author = null;
    if (entry.authorProfileId) {
      author = JSON.parse(
        fs.readFileSync(
          path.join(root, 'authors', `${entry.authorProfileId}.json`),
          'utf8',
        ),
      );
    }
    const axes = { ...(author?.axes || {}), ...(overlay.axes || {}) };
    // merge like resolve: author base, overlay wins
    const merged = {};
    for (const k of AXES) {
      merged[k] = (overlay.axes && overlay.axes[k]) || (author && author.axes[k]) || '';
    }
    for (const k of AXES) {
      if (!(merged[k] || '').trim()) {
        bad++;
        break;
      }
    }
    const refs = [...(overlay.references || []), ...(author?.references || [])];
    if (!refs.some((r) => r.title && (r.url || r.citation))) {
      bad++;
    }
  }
  assert.strictEqual(bad, 0, `coverage failures: ${bad}`);

  // Augustine multi-obra
  const conf = JSON.parse(
    fs.readFileSync(
      path.join(root, 'documents/agustin-02-confesiones-es.json'),
      'utf8',
    ),
  );
  const cdd = JSON.parse(
    fs.readFileSync(
      path.join(root, 'documents/agustin-16-ciudad-de-dios-1-es.json'),
      'utf8',
    ),
  );
  assert.strictEqual(conf.authorProfileId, 'agustin-hipona');
  assert.strictEqual(cdd.authorProfileId, 'agustin-hipona');
  assert.notStrictEqual(conf.chronologyNote, cdd.chronologyNote);
  assert.notStrictEqual(conf.compositionYears, cdd.compositionYears);

  // Dense citations on author profile
  const ag = JSON.parse(
    fs.readFileSync(path.join(root, 'authors/agustin-hipona.json'), 'utf8'),
  );
  assert.ok((ag.summaryRefIds || []).length >= 1, 'author summaryRefIds');
  assert.ok(ag.axisSources && ag.axisSources.lugar?.length >= 1, 'author axisSources');
  assert.ok(
    (ag.references || []).every((r) => r.id),
    'author refs have stable ids',
  );
  assert.ok((conf.workSummaryRefIds || []).length >= 1, 'doc workSummaryRefIds');
  assert.ok((conf.chronologyRefIds || []).length >= 1, 'doc chronologyRefIds');
  assert.ok(
    (conf.references || []).some((r) => r.id === 'aug-conf' || r.id === 'brown-ag'),
    'confesiones bibliography includes primary/secondary ids',
  );

  const samples = ['cic-es', 'nicea-i-la', 'agustin-02-confesiones-es'];
  for (const id of samples) {
    assert.ok(packIds.has(id), `sample ${id}`);
  }

  console.log('ok context-offline-load');
  console.log(
    JSON.stringify({
      documents: a.documents.length,
      authors: a.authors.length,
      missing: 0,
      coverageFail: 0,
      denseCitations: true,
      samples,
    }),
  );
}

main();
