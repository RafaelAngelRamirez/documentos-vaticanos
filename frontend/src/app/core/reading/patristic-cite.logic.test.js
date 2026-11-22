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
    cite.parsePatristicCite('Clemente de Alejandría, Paedagogus 1, 6, 42'),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('Novaciano, De Trinitate, 29'),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('Novaciano, De Trinitate, 2, 1, 2'),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('De Trinitate, XXIX, 9-10: CCL 4, 70'),
    null,
  );
  assert.strictEqual(cite.parsePatristicCite('De Trinitate, 16, 1, 1'), null);
  assert.strictEqual(
    cite.parsePatristicCite(
      'St. Hilary, De Trinitate, VIII, 19, 21: PL 10, 250',
    ),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('Confesiones, 2,8; 2,10; 2,14'),
    null,
  );
  assert.strictEqual(
    cite.parsePatristicCite('De Trinitate, 1. 15, 11'),
    null,
  );

  section('Confessiones 1,1,1 opens that NPNF paragraph');
  const confCite = cite.parsePatristicCite('San Agustín, Confessiones, 1,1,1');
  assert.ok(confCite);
  assert.strictEqual(confCite.documentId, cite.AUGUSTINE_CONFESSIONS_ID);
  assert.deepStrictEqual(confCite.locate, {
    kind: 'bookParagraph',
    book: 1,
    chapter: 1,
    paragraph: 1,
  });
  const confUnits = loadUnits(cite.AUGUSTINE_CONFESSIONS_ID);
  const confPassage = cite.citedPassageForPatristic(confCite, confUnits);
  assert.ok(confPassage);
  assert.strictEqual(confPassage.verses.length, 1);
  assert.ok(confPassage.verses[0].text.includes('Great art Thou'));
  assert.ok(confPassage.verses[0].text.includes('restless'));
  assert.ok(!confPassage.verses[0].text.startsWith('1.'));
  assert.strictEqual(confPassage.verses[0].verse, 1);
  assert.ok(confPassage.verses.length < confUnits.length);

  section('Confesiones, I, 1 is book I chapter 1 paragraph 1');
  const fichaConf = cite.parsePatristicCite('Confesiones, I, 1');
  assert.ok(fichaConf);
  assert.strictEqual(fichaConf.documentId, cite.AUGUSTINE_CONFESSIONS_ID);
  assert.deepStrictEqual(fichaConf.locate, {
    kind: 'bookParagraph',
    book: 1,
    chapter: 1,
    paragraph: 1,
  });
  const fichaConfPassage = cite.citedPassageForPatristic(fichaConf, confUnits);
  assert.ok(fichaConfPassage);
  assert.strictEqual(fichaConfPassage.verses.length, 1);
  assert.ok(fichaConfPassage.verses[0].text.includes('Great art Thou'));
  assert.ok(fichaConfPassage.verses[0].text.includes('restless'));
  assert.ok(fichaConfPassage.verses.length < confUnits.length);

  section('De Trinitate, I, 1 is the opening NPNF paragraph');
  const fichaTri = cite.parsePatristicCite('De Trinitate, I, 1');
  assert.ok(fichaTri);
  assert.strictEqual(fichaTri.documentId, cite.AUGUSTINE_TRINITY_ID);
  assert.deepStrictEqual(fichaTri.locate, {
    kind: 'bookParagraph',
    book: 1,
    chapter: 1,
    paragraph: 1,
  });

  section('De Trinitate 15,26,47 opens that NPNF paragraph');
  const trinityCite = cite.parsePatristicCite(
    'S. Agustín, De Trinitate, 15,26,47',
  );
  assert.ok(trinityCite);
  assert.strictEqual(trinityCite.documentId, cite.AUGUSTINE_TRINITY_ID);
  assert.deepStrictEqual(trinityCite.locate, {
    kind: 'bookParagraph',
    book: 15,
    chapter: 26,
    paragraph: 47,
  });
  const trinityUnits = loadUnits(cite.AUGUSTINE_TRINITY_ID);
  const fichaTriPassage = cite.citedPassageForPatristic(fichaTri, trinityUnits);
  assert.ok(fichaTriPassage);
  assert.strictEqual(fichaTriPassage.verses.length, 1);
  assert.ok(
    fichaTriPassage.verses[0].text.includes('following dissertation'),
  );
  assert.ok(fichaTriPassage.verses.length < trinityUnits.length);

  const trinityPassage = cite.citedPassageForPatristic(
    trinityCite,
    trinityUnits,
  );
  assert.ok(trinityPassage);
  assert.strictEqual(trinityPassage.verses.length, 1);
  assert.ok(
    trinityPassage.verses[0].text.includes(
      'Holy Spirit had already proceeded',
    ),
  );
  assert.strictEqual(trinityPassage.verses[0].verse, 47);
  assert.ok(trinityPassage.verses.length < trinityUnits.length);

  section('the footnotes that name these two works');
  const amoris = cite.parsePatristicCite('Confesiones, 8, 3, 7: PL 32, 752.');
  assert.ok(amoris);
  assert.strictEqual(amoris.documentId, cite.AUGUSTINE_CONFESSIONS_ID);
  assert.deepStrictEqual(amoris.locate, {
    kind: 'bookParagraph',
    book: 8,
    chapter: 3,
    paragraph: 7,
  });
  assert.ok(amoris.editionNote.startsWith('PL 32, 752. '));
  const restored = cite.citedPassageForPatristic(amoris, confUnits);
  assert.ok(restored.verses[0].text.includes('delights at finding'));

  const dce = cite.parsePatristicCite(
    'De Trinitate, VIII, 8, 12: CCL 50, 287.',
  );
  assert.ok(dce);
  assert.deepStrictEqual(dce.locate, {
    kind: 'bookParagraph',
    book: 8,
    chapter: 8,
    paragraph: 12,
  });
  assert.ok(dce.editionNote.startsWith('CCL 50, 287. '));
  const love = cite.citedPassageForPatristic(dce, trinityUnits);
  assert.ok(love.verses[0].text.includes('I do not know what I love'));

  const dotted = cite.parsePatristicCite('Confessiones, 7,7.11');
  assert.deepStrictEqual(dotted.locate, {
    kind: 'bookParagraph',
    book: 7,
    chapter: 7,
    paragraph: 11,
  });
  const evil = cite.citedPassageForPatristic(dotted, confUnits);
  assert.ok(evil.verses[0].text.includes('Whence is evil'));

  const bare = cite.parsePatristicCite('San Agustín, Confessiones 9, 6, 14');
  assert.deepStrictEqual(bare.locate, {
    kind: 'bookParagraph',
    book: 9,
    chapter: 6,
    paragraph: 14,
  });

  const semi = cite.parsePatristicCite('Confessiones, 10, 29; 40');
  assert.deepStrictEqual(semi.locate, {
    kind: 'bookParagraph',
    book: 10,
    chapter: 29,
    paragraph: 40,
  });
  const command = cite.citedPassageForPatristic(semi, confUnits);
  assert.ok(command.verses[0].text.includes('Give what Thou commandest'));

  const mixed =
    'Cf. S. Agustín, De libero arbitrio, 3, 21, 59: PL 32, 1300; De Trinitate, 2, 1, 2: PL 42, 845.';
  const mixedSpans = cite.findPatristicSpans(mixed);
  assert.strictEqual(mixedSpans.length, 1);
  assert.strictEqual(mixedSpans[0].cite.documentId, cite.AUGUSTINE_TRINITY_ID);
  assert.deepStrictEqual(mixedSpans[0].cite.locate, {
    kind: 'bookParagraph',
    book: 2,
    chapter: 1,
    paragraph: 2,
  });
  assert.ok(!mixedSpans[0].label.includes('libero'));
  const rule = cite.citedPassageForPatristic(mixedSpans[0].cite, trinityUnits);
  assert.ok(rule.verses[0].text.includes('canonical rule'));

  section('a repeated paragraph in one chapter is not a passage');
  const repeated = [
    { contenido: 'Book 1.' },
    { contenido: 'Chapter 1. Opening' },
    { contenido: '1. Alpha' },
    { contenido: '1. Beta' },
  ];
  assert.strictEqual(
    cite.citedPassageForPatristic(confCite, repeated),
    null,
  );
  const scoped = [
    { contenido: 'Book 1.' },
    { contenido: 'Chapter 1. Opening' },
    { contenido: '1. Only here' },
    { contenido: 'Chapter 2. Next' },
    { contenido: '2. Other' },
  ];
  assert.strictEqual(
    cite.citedPassageForPatristic(
      {
        ...confCite,
        locate: { kind: 'bookParagraph', book: 1, chapter: 2, paragraph: 1 },
      },
      scoped,
    ),
    null,
  );
  const only = cite.citedPassageForPatristic(confCite, scoped);
  assert.ok(only.verses[0].text.includes('Only here'));

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

  section('a cold citation says it is downloading');
  const progress = await import(
    pathToFileURL(
      path.join(HERE, '../corpus/download-progress.logic.ts'),
    ).href
  );
  assert.strictEqual(progress.citedDownloadCaption(null), 'Descargando…');
  assert.strictEqual(
    progress.citedDownloadCaption({ loaded: 0, total: null }),
    'Descargando…',
  );
  assert.strictEqual(
    progress.citedDownloadCaption({ loaded: 50, total: 200 }),
    'Descargando… 25%',
  );
  assert.strictEqual(
    progress.citedDownloadCaption({ loaded: 200, total: 200 }),
    'Descargando… 99%',
  );

  section('inicio and the ficha use this door');
  const inicio = fs.readFileSync(
    path.join(HERE, '../../pages/inicio/inicio.component.ts'),
    'utf8',
  );
  const padre = fs.readFileSync(
    path.join(HERE, '../../pages/padre-detalle/padre-detalle.component.ts'),
    'utf8',
  );
  const corpus = fs.readFileSync(
    path.join(HERE, '../corpus/corpus.service.ts'),
    'utf8',
  );
  assert.ok(inicio.includes('ensureForCitedPassage'));
  assert.ok(inicio.includes('loadingLectura'));
  assert.ok(inicio.includes("Descargando…"));
  assert.ok(!inicio.includes('Abriendo…'));
  assert.ok(padre.includes('citedPassageForPatristic'));
  assert.ok(padre.includes('ensureLoaded'));
  assert.ok(padre.includes('quoteCite'));
  assert.ok(corpus.includes("ngsw-bypass"));
  assert.ok(corpus.includes('downloadProgress$'));

  console.log('\npatristic-cite.logic.test.js OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
