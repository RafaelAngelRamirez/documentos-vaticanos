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
  assert.ok(
    lectorSrc.includes('rateScale') || lectorSrc.includes('prep.kind'),
    'lector uses heading rate/kind from prep',
  );
  const PUNTO_TS = path.resolve(
    HERE,
    '../components/punto/punto/punto.component.ts',
  );
  const PUNTO_HTML = path.resolve(
    HERE,
    '../components/punto/punto/punto.component.html',
  );
  const PUNTO_CSS = path.resolve(
    HERE,
    '../components/punto/punto/punto.component.css',
  );
  assert.ok(fs.existsSync(PUNTO_TS), 'punto.component.ts exists');
  const puntoTs = fs.readFileSync(PUNTO_TS, 'utf8');
  const puntoHtml = fs.readFileSync(PUNTO_HTML, 'utf8');
  const puntoCss = fs.readFileSync(PUNTO_CSS, 'utf8');
  assert.ok(
    puntoTs.includes('isStructuralHeading'),
    'punto uses isStructuralHeading',
  );
  assert.ok(
    puntoHtml.includes('punto-heading') || puntoHtml.includes('isHeading'),
    'punto template marks headings',
  );
  assert.ok(
    puntoCss.includes('punto-heading'),
    'punto CSS styles headings',
  );
  assert.ok(
    !/#(?:[0-9a-fA-F]{3}){1,2}\b/.test(
      puntoCss.match(/punto-heading[\s\S]{0,400}/)?.[0] || '',
    ),
    'heading styles avoid loose hex (tokens only)',
  );

  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);
  const {
    OCR_OMIT_PLACEHOLDER,
    HEADING_RATE_SCALE,
    prepareSpeechText,
    prepareHeadingSpeakText,
    normalizeSpeakText,
    isSpeakHostileJunk,
    isStructuralHeading,
    extractUnitRaw,
    extractUnitFields,
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

  section('structural heading detection');
  assert.strictEqual(
    isStructuralHeading('PRIMERA PARTE LA PROFESIÓN DE LA FE'),
    true,
    'PARTE heading',
  );
  assert.strictEqual(
    isStructuralHeading('PRIMERA SECCIÓN «CREO»-«CREEMOS»'),
    true,
    'SECCIÓN heading',
  );
  assert.strictEqual(
    isStructuralHeading(
      'CAPÍTULO PRIMERO: EL HOMBRE ES "CAPAZ" DE DIOS',
    ),
    true,
    'CAPÍTULO heading',
  );
  assert.strictEqual(
    isStructuralHeading('ARTÍCULO 1 LA REVELACIÓN DE DIOS'),
    true,
    'ARTÍCULO heading',
  );
  assert.strictEqual(
    isStructuralHeading('PRÓLOGO'),
    true,
    'PRÓLOGO heading',
  );
  assert.strictEqual(
    isStructuralHeading('1. Introducción'),
    true,
    'numbered Introducción',
  );
  assert.strictEqual(
    isStructuralHeading('CONSTITUCIÓN APOSTÓLICA'),
    true,
    'CONSTITUCIÓN APOSTÓLICA',
  );
  // Body prose must not be a heading
  assert.strictEqual(
    isStructuralHeading(prose),
    false,
    'good prose not heading',
  );
  assert.strictEqual(
    isStructuralHeading(
      '1. Cristo es la luz de los pueblos. Por ello este sacrosanto Sínodo.',
      { consecutivo: '1' },
    ),
    false,
    'LG-style body with article consecutivo not heading',
  );
  // Short body with article number stays body even if short
  assert.strictEqual(
    isStructuralHeading('Dios es amor.', { consecutivo: '27' }),
    false,
    'short body with consecutivo not ALL-CAPS heading',
  );

  section('calm heading speak prep');
  const cap = prepareSpeechText(
    'CAPÍTULO PRIMERO: EL HOMBRE ES "CAPAZ" DE DIOS',
  );
  assert.strictEqual(cap.skip, false, 'capítulo speakable');
  assert.strictEqual(cap.kind, 'heading', 'kind=heading');
  assert.ok(
    cap.rateScale != null && cap.rateScale < 1,
    'calmer rateScale for heading',
  );
  assert.strictEqual(
    cap.rateScale,
    HEADING_RATE_SCALE,
    'uses HEADING_RATE_SCALE',
  );
  // Soft case: not all-shout
  assert.ok(
    !/^CAPÍTULO PRIMERO/.test(cap.text),
    'does not keep full ALL-CAPS shout',
  );
  assert.ok(
    /cap[ií]tulo/i.test(cap.text),
    'keeps capítulo wording',
  );
  // Pause after label (period between label and rest)
  assert.ok(
    /\.\s+/.test(cap.text) || /…/.test(cap.text),
    'has pause punctuation',
  );
  assert.ok(
    /hombre/i.test(cap.text) && /dios/i.test(cap.text),
    'keeps semantic words',
  );
  // No OCR-period joins invented
  assert.ok(!cap.text.includes('quedista'), 'no quedista in heading');

  const parte = prepareSpeechText('PRIMERA PARTE LA PROFESIÓN DE LA FE');
  assert.strictEqual(parte.kind, 'heading');
  assert.ok(
    /primera\s+parte/i.test(parte.text),
    'parte label present',
  );
  assert.ok(
    /profesi[oó]n/i.test(parte.text),
    'keeps profesión',
  );
  // Label pause: "parte." then rest
  assert.ok(
    /parte\.\s+/i.test(parte.text),
    'pause after parte label',
  );

  const calm = prepareHeadingSpeakText('ARTÍCULO 1 LA REVELACIÓN DE DIOS');
  assert.ok(calm.length > 5, 'heading speak non-empty');
  assert.ok(/[.…]$/.test(calm.trim()) || /…/.test(calm), 'terminal pause');

  section('standalone label+ordinal/numeral (no mis-split)');
  // Label-only headings must stay one clause — not "Capítulo. Primero…"
  for (const [raw, mustInclude, mustNot] of [
    ['CAPÍTULO PRIMERO', /cap[ií]tulo\s+primero/i, /cap[ií]tulo\.\s*primero/i],
    ['ARTÍCULO 1', /art[ií]culo\s+1/i, /art[ií]culo\.\s*1/i],
    ['CAPÍTULO II', /cap[ií]tulo\s+II\b/i, /cap[ií]tulo\.\s*I/i],
    ['SECCIÓN PRIMERA', /secci[oó]n\s+primera/i, /secci[oó]n\.\s*primera/i],
  ]) {
    const r = prepareSpeechText(raw);
    assert.strictEqual(r.skip, false, `${raw} speakable`);
    assert.strictEqual(r.kind, 'heading', `${raw} kind=heading`);
    assert.ok(mustInclude.test(r.text), `${raw} keeps label whole: ${r.text}`);
    assert.ok(!mustNot.test(r.text), `${raw} no mis-split: ${r.text}`);
    // No "Label. Ordinal" pattern for bare labels
    assert.ok(
      !/^(?:cap[ií]tulo|art[ií]culo|secci[oó]n|t[ií]tulo|parte)\.\s/i.test(
        r.text,
      ),
      `${raw} no period right after bare kind: ${r.text}`,
    );
  }

  section('Roman numerals stay uppercase (not Iii)');
  assert.strictEqual(mod.isRomanNumeralToken('III'), true);
  assert.strictEqual(mod.isRomanNumeralToken('Ii'), true); // case-insensitive match
  assert.strictEqual(mod.isRomanNumeralToken('Dios'), false);
  const tit3 = prepareSpeechText('TÍTULO III DE LOS SACRAMENTOS');
  assert.strictEqual(tit3.kind, 'heading');
  assert.ok(/\bIII\b/.test(tit3.text), `keeps III uppercase: ${tit3.text}`);
  assert.ok(!/\bIii\b/.test(tit3.text), `no Iii: ${tit3.text}`);
  assert.ok(
    /t[ií]tulo\s+III\.\s+/i.test(tit3.text),
    `pause after Título III: ${tit3.text}`,
  );
  const cap2 = prepareSpeechText('CAPÍTULO II');
  assert.ok(/\bII\b/.test(cap2.text), `Capítulo II keeps II: ${cap2.text}`);
  assert.ok(!/\bIi\b/.test(cap2.text), `no Ii: ${cap2.text}`);

  section('body prep still body kind');
  assert.strictEqual(good.kind, 'body', 'prose kind=body');
  assert.ok(
    good.rateScale == null || good.rateScale === 1,
    'body has no calm rateScale',
  );

  section('heading + nextSpeakableIndex with consecutivo');
  const mixed = [
    { contenido: '', consecutivo: 'no-encontrado' },
    { contenido: OCR_OMIT_PLACEHOLDER, consecutivo: 'no-encontrado' },
    {
      contenido: 'CAPÍTULO SEGUNDO DIOS AL ENCUENTRO DEL HOMBRE',
      consecutivo: 'no-encontrado',
    },
    {
      contenido: prose,
      consecutivo: '51',
    },
  ];
  const h0 = nextSpeakableIndex(mixed, 0);
  assert.ok(h0, 'finds heading after skips');
  assert.strictEqual(h0.index, 2, 'lands on capítulo');
  assert.strictEqual(h0.prep.kind, 'heading');
  assert.ok(h0.prep.rateScale < 1);
  const h1 = nextSpeakableIndex(mixed, 3);
  assert.strictEqual(h1.index, 3);
  assert.strictEqual(h1.prep.kind, 'body');

  section('extractUnitFields');
  const fields = extractUnitFields({
    contenido: 'Hola',
    consecutivo: '12',
  });
  assert.strictEqual(fields.raw, 'Hola');
  assert.strictEqual(fields.consecutivo, '12');

  section('real pack heading sample (cic-es)');
  const CORPUS_CIC = path.resolve(
    HERE,
    '../../assets/corpus/documents/cic-es/content.json',
  );
  if (fs.existsSync(CORPUS_CIC)) {
    const cic = JSON.parse(fs.readFileSync(CORPUS_CIC, 'utf8'));
    // Known structural units from pack
    const u117 = cic[117];
    const f117 = extractUnitFields(u117);
    assert.ok(
      isStructuralHeading(f117.raw, { consecutivo: f117.consecutivo }),
      'cic u117 is structural heading',
    );
    const p117 = prepareSpeechText(f117.raw, {
      consecutivo: f117.consecutivo,
    });
    assert.strictEqual(p117.kind, 'heading');
    assert.strictEqual(p117.skip, false);
    assert.ok(p117.rateScale < 1);
    console.log('  cic-es u117 speak:', p117.text.slice(0, 90) + '…');
  } else {
    console.log('  (cic-es pack missing — skip)');
  }

  console.log('\nAll speech-prep tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
