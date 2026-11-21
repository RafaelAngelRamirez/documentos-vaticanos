/**
 * Patristic cites open only the passage that can be cut from the offline work.
 *   bash scripts/node-strip-types.sh frontend/src/app/core/reading/patristic-cite.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { register } = require('node:module');

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (
          (specifier.startsWith('./') || specifier.startsWith('../')) &&
          !/\\.(ts|js|mjs|cjs|json|node)$/i.test(specifier)
        ) {
          try {
            return await nextResolve(specifier + '.ts', context);
          } catch {}
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../..');

function section(name) {
  console.log(`\n== ${name} ==`);
}

function loadUnits(id) {
  const file = path.join(
    REPO,
    'documentos/corpus/documents',
    id,
    'content.json',
  );
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const cite = await import(pathToFileURL(path.join(HERE, 'patristic-cite.logic.ts')).href);
  const pack = await import(
    pathToFileURL(
      path.join(HERE, '../corpus/patristic-pack.logic.ts'),
    ).href
  );

  section('web manifest already carries the works');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(REPO, 'documentos/corpus/manifest.json'), 'utf8'),
  );
  assert.strictEqual(
    pack.baseManifestIncludesPatristic(manifest.documents),
    true,
  );
  assert.strictEqual(
    pack.baseManifestIncludesPatristic([
      { id: 'padre-es', kind: 'patristic', packId: 'patristica' },
    ]),
    false,
  );
  assert.strictEqual(pack.baseManifestIncludesPatristic([]), false);

  section('CIC 460 names one section of De Incarnatione');
  const label =
    'San Atanasio de Alejandría, De Incarnatione, 54, 3: PG 25, 192B';
  const parsed = cite.parsePatristicCite(label);
  assert.ok(parsed);
  assert.strictEqual(parsed.documentId, cite.ATHANASIUS_INCARNATION_ID);
  assert.deepStrictEqual(parsed.locate, { kind: 'section', section: 54 });
  assert.ok(parsed.editionNote.startsWith('PG 25, 192B. '));
  assert.ok(parsed.editionNote.includes('parágrafo 54'));

  const cic = loadUnits('cic-es');
  const prose = cic[876].contenido;
  assert.ok(prose.includes(label));
  const spans = cite.findPatristicSpans(prose);
  assert.strictEqual(spans.length, 1);
  assert.strictEqual(spans[0].label, label);
  assert.ok(!prose.slice(0, spans[0].start).includes('De Incarnatione'));

  const athanasius = loadUnits(cite.ATHANASIUS_INCARNATION_ID);
  const passage = cite.citedPassageForPatristic(parsed, athanasius);
  assert.ok(passage);
  assert.ok(passage.verses.length >= 1);
  assert.ok(passage.verses.length < 8);
  assert.ok(passage.verses.length < athanasius.length);
  assert.ok(passage.verses[0].text.includes('Word Incarnate'));
  assert.ok(passage.verses[0].text.includes('deifying'));
  assert.ok(!passage.verses[0].text.startsWith('54.'));
  assert.strictEqual(passage.verses[0].verse, 54);

  section('a repeated section number is not a passage');
  const ambiguous = cite.citedPassageForPatristic(
    { ...parsed, locate: { kind: 'section', section: 3 } },
    athanasius,
  );
  assert.strictEqual(ambiguous, null);

  section('Diogneto V–VI is those chapters');
  const letter = cite.parsePatristicCite('Carta a Diogneto, V–VI');
  assert.ok(letter);
  assert.strictEqual(letter.documentId, cite.DIOGNETUS_ID);
  assert.deepStrictEqual(letter.locate, { kind: 'chapters', chapters: [5, 6] });
  const diogneto = loadUnits(cite.DIOGNETUS_ID);
  const chapters = cite.citedPassageForPatristic(letter, diogneto);
  assert.ok(chapters);
  assert.ok(chapters.verses.length >= 2);
  assert.ok(chapters.verses.length < diogneto.length);
  assert.ok(chapters.verses[0].text.startsWith('V. '));
  assert.ok(chapters.verses[chapters.verses.length - 1].text.startsWith('VI. '));
  assert.ok(!chapters.verses.some((verse) => verse.text.startsWith('I. ')));
  assert.ok(!chapters.verses.some((verse) => verse.text.startsWith('XI. ')));

  section('the title alone does not open the letter');
  assert.strictEqual(cite.parsePatristicCite('Carta a Diogneto'), null);
  assert.strictEqual(
    cite.parsePatristicCite('San Agustín, Confessiones, 1,1,1'),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('S. Agustín, De Trinitate, 15,26,47'),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('Clemente de Alejandría, Paedagogus 1, 6, 42'),
    null,
  );

  section('the reader and settings use this door');
  const punto = fs.readFileSync(
    path.join(HERE, '../../components/punto/punto/punto.component.ts'),
    'utf8',
  );
  const lector = fs.readFileSync(
    path.join(HERE, '../../components/lector/lector.component.ts'),
    'utf8',
  );
  const ajustes = fs.readFileSync(
    path.join(HERE, '../../pages/ajustes/ajustes.component.html'),
    'utf8',
  );
  const ajustesTs = fs.readFileSync(
    path.join(HERE, '../../pages/ajustes/ajustes.component.ts'),
    'utf8',
  );
  assert.ok(punto.includes('findPatristicSpans'));
  assert.ok(lector.includes('citedPassageForPatristic'));
  assert.ok(lector.includes('ensureLoaded(documentId)'));
  assert.ok(ajustes.includes('patristicInBase'));
  assert.ok(ajustes.includes('patristic-in-base'));
  assert.ok(ajustes.includes('patristicShelfReady && !patristicInBase'));
  assert.ok(ajustesTs.includes('baseManifestIncludesPatristic'));

  console.log('\npatristic-cite.logic.test.js OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
