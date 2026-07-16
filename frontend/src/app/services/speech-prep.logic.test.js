/**
 * Speech-prep for integrated voices — drives the shipped pure module.
 * Run: node --experimental-strip-types src/app/services/speech-prep.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HERE = __dirname;
const LOGIC = path.join(HERE, 'speech-prep.logic.ts');
const LECTOR = path.resolve(HERE, '../components/lector/lector.component.ts');
// services → app → src → assets/corpus (offline pack dual-write)
const CORPUS_LG = path.resolve(
  HERE,
  '../../assets/corpus/documents/lg-es/content.json',
);
const CORPUS_OCR = path.resolve(
  HERE,
  '../../assets/corpus/documents/agustin-31-antimaniqueos-2-es/content.json',
);

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  section('artifacts');
  assert.ok(fs.existsSync(LOGIC), 'speech-prep.logic.ts exists');
  const lectorSrc = fs.readFileSync(LECTOR, 'utf8');
  assert.ok(
    lectorSrc.includes('prepareSpeechText') ||
      lectorSrc.includes('nextSpeakableIndex'),
    'lector wires speech-prep helper',
  );
  assert.ok(
    lectorSrc.includes('speech-prep.logic'),
    'lector imports speech-prep.logic',
  );

  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const {
    OCR_OMIT_PLACEHOLDER,
    prepareSpeechText,
    normalizeSpeakText,
    isSpeakHostileJunk,
    extractUnitRaw,
    nextSpeakableIndex,
  } = mod;

  section('good prose stable');
  const prose =
    'Dios es bueno y misericordioso. La fe es el fundamento de la salvación.';
  const good = prepareSpeechText(prose);
  assert.strictEqual(good.skip, false, 'good prose not skipped');
  assert.ok(good.text.includes('misericordioso'), 'keeps wording');
  assert.ok(good.text.includes('salvación'), 'keeps salvación');
  // letter tokens stable (no mass rewrite)
  const letters = (s) => s.match(/[A-Za-zÁ-ÿ]{3,}/g) || [];
  assert.deepStrictEqual(
    letters(good.text).sort(),
    letters(prose).sort(),
    'letter tokens stable on clean prose',
  );

  section('no internal-period joins');
  for (const raw of ['que.dista el sol', 'es.decir, mueran', 'art.cit p.194']) {
    const r = prepareSpeechText(raw);
    assert.strictEqual(r.skip, false, `${raw} speakable`);
    assert.ok(r.text.includes(raw.split(' ')[0]) || r.text.includes('.'), raw);
    assert.ok(!r.text.includes('quedista'), 'no quedista');
    assert.ok(!r.text.includes('esdecir'), 'no esdecir');
    assert.ok(!r.text.includes('artcit'), 'no artcit');
    // period still present between lower runs
    assert.ok(
      /[a-záéíóú]{2}\.[a-záéíóú]{2}/i.test(r.text) ||
        r.text.includes('que.dista') ||
        r.text.includes('es.decir') ||
        r.text.includes('art.cit'),
      `keeps internal period form for ${raw}`,
    );
  }

  section('empty + placeholder skip');
  assert.strictEqual(prepareSpeechText('').skip, true);
  assert.strictEqual(prepareSpeechText('   ').reason, 'empty');
  const ph = prepareSpeechText(OCR_OMIT_PLACEHOLDER);
  assert.strictEqual(ph.skip, true, 'placeholder skipped');
  assert.strictEqual(ph.reason, 'placeholder');
  assert.strictEqual(ph.text, '', 'placeholder yields empty speak text');
  assert.strictEqual(
    prepareSpeechText('[OCR: índice o tabla ilegible omitido]').skip,
    true,
  );

  section('TOC / leader junk skip');
  const toc =
    'INDICE GENERAL Págs. INTRODUCCIÓN ..ooonconicininnionicononcorann 87 3. La respuesta ..occocconicinicnnionorererncor 99';
  assert.strictEqual(isSpeakHostileJunk(toc), true, 'toc is hostile');
  const tocPrep = prepareSpeechText(toc);
  assert.strictEqual(tocPrep.skip, true, 'toc skipped for speech');
  assert.ok(
    tocPrep.reason === 'toc_junk' || tocPrep.reason === 'placeholder',
    `toc reason ${tocPrep.reason}`,
  );

  section('HTML / ref strip (still speakable)');
  const htmlish =
    'Como dice el Concilio <i>Lumen gentium</i> [+[12]+] la Iglesia es sacramento.';
  const stripped = prepareSpeechText(htmlish);
  assert.strictEqual(stripped.skip, false);
  assert.ok(!stripped.text.includes('<i>'), 'no html tags');
  assert.ok(!stripped.text.includes('[+[12]+]'), 'no ref placeholder');
  assert.ok(stripped.text.includes('Iglesia'), 'keeps Iglesia');

  section('extractUnitRaw + nextSpeakableIndex');
  assert.strictEqual(
    extractUnitRaw({ contenido: 'Hola mundo' }),
    'Hola mundo',
  );
  const units = [
    { contenido: '' },
    { contenido: OCR_OMIT_PLACEHOLDER },
    { contenido: toc },
    { contenido: prose },
    { contenido: 'Segundo párrafo legible para la voz.' },
  ];
  const n0 = nextSpeakableIndex(units, 0);
  assert.ok(n0, 'finds speakable');
  assert.strictEqual(n0.index, 3, 'skips empty/placeholder/toc to prose');
  assert.ok(n0.prep.text.includes('misericordioso'));
  const n1 = nextSpeakableIndex(units, 4);
  assert.strictEqual(n1.index, 4);
  assert.strictEqual(nextSpeakableIndex(units, 5), null, 'end → null');

  section('real offline pack samples');
  if (fs.existsSync(CORPUS_LG)) {
    const lg = JSON.parse(fs.readFileSync(CORPUS_LG, 'utf8'));
    const unit = lg[5] || lg[1];
    const prep = prepareSpeechText(extractUnitRaw(unit));
    assert.strictEqual(prep.skip, false, 'lg-es unit speakable');
    assert.ok(prep.text.length > 20, 'lg speak text non-empty');
    console.log('  lg-es sample:', prep.text.slice(0, 80) + '…');
  } else {
    console.log('  (lg-es pack missing — skip pack sample)');
  }
  if (fs.existsSync(CORPUS_OCR)) {
    const pack = JSON.parse(fs.readFileSync(CORPUS_OCR, 'utf8'));
    // unit 11 was TOC garbage → placeholder after ocr-abc
    const u11 = extractUnitRaw(pack[11]);
    const prep11 = prepareSpeechText(u11);
    assert.strictEqual(prep11.skip, true, 'agustin-31 u11 skipped');
    console.log('  agustin-31 u11 reason:', prep11.reason, 'raw:', u11.slice(0, 60));
    // find a later body unit that speaks
    const next = nextSpeakableIndex(pack, 50);
    assert.ok(next, 'finds later speakable body unit');
    assert.ok(next.prep.text.length > 10, 'body speak text non-empty');
    console.log(
      '  agustin-31 next@',
      next.index,
      ':',
      next.prep.text.slice(0, 70) + '…',
    );
  }

  section('normalizeSpeakText does not invent joins');
  assert.strictEqual(
    normalizeSpeakText('que.dista'),
    'que.dista',
    'normalize keeps que.dista',
  );

  console.log('\nAll speech-prep tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
