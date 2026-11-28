/**
 * Citation ranges, jumps, and offline extraction.
 * Run: bash ../../../../../scripts/node-strip-types.sh src/app/core/liturgia/bible-cite.logic.test.js
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

function pairs(verses) {
  return verses.map((v) => `${v.chapter}:${v.verse}`);
}

async function main() {
  const cite = await import(
    pathToFileURL(path.join(__dirname, 'bible-cite.logic.ts')).href
  );
  const biblePath = path.resolve(
    __dirname,
    '../../../../../documentos/corpus/documents/bible-pueblo-de-dios-es/content.json',
  );
  const units = JSON.parse(fs.readFileSync(biblePath, 'utf8'));

  const ap = cite.parseLectionaryPassage('Ap 3,1-6.14-22');
  assert.ok(ap);
  assert.strictEqual(ap.code, 'Ap');
  assert.deepStrictEqual(
    ap.spans.map((s) => [s.chapter, s.start, s.end]),
    [
      [3, 1, 6],
      [3, 14, 22],
    ],
  );
  const apVerses = cite.collectCitedVerses(units, ap);
  assert.deepStrictEqual(
    apVerses.map((v) => v.verse),
    [1, 2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  );
  assert.strictEqual(apVerses[0].spanBreakBefore, false);
  assert.ok(apVerses.slice(1, 6).every((v) => v.spanBreakBefore === false));
  const laodicea = apVerses.find((v) => v.verse === 14);
  assert.ok(laodicea);
  assert.strictEqual(laodicea.spanBreakBefore, true);
  assert.ok(apVerses.filter((v) => v.spanBreakBefore).length === 1);
  assert.ok(apVerses[0].text.includes('Sardes'));
  assert.ok(laodicea.text.includes('Laodicea'));
  assert.ok(!apVerses.some((v) => /Filadelfia|sinagoga de Satanás/.test(v.text)));
  const apSpeech = cite.passageSpeechText(apVerses);
  assert.ok(apSpeech.includes('Sardes'));
  assert.ok(apSpeech.includes('Laodicea'));
  assert.ok(!/Filadelfia|sinagoga de Satanás/.test(apSpeech));
  assert.ok(!apSpeech.includes('7 Escribe'));

  const first = cite.parseLectionaryCite('Mt 19,23-30');
  assert.strictEqual(first.chapter, '19');
  assert.strictEqual(first.verse, 23);

  const jump = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Gn 3,9-15.20'),
  );
  assert.deepStrictEqual(
    jump.map((v) => v.verse),
    [9, 10, 11, 12, 13, 14, 15, 20],
  );

  const chapters = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Ap 1,1-4;2,1-5'),
  );
  assert.deepStrictEqual(pairs(chapters), [
    '1:1',
    '1:2',
    '1:3',
    '1:4',
    '2:1',
    '2:2',
    '2:3',
    '2:4',
    '2:5',
  ]);

  const cross = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Mt 9,35\u201310,1.5a.6-8'),
  );
  assert.deepStrictEqual(pairs(cross), [
    '9:35',
    '9:36',
    '9:37',
    '9:38',
    '10:1',
    '10:5',
    '10:6',
    '10:7',
    '10:8',
  ]);

  const ordered = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Is 38,1-6.21-22.7-8'),
  );
  assert.deepStrictEqual(
    ordered.map((v) => v.verse),
    [1, 2, 3, 4, 5, 6, 21, 22, 7, 8],
  );

  const plus = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Sal 118,1+8-9.19-21.25-27a'),
  );
  assert.deepStrictEqual(
    plus.map((v) => v.verse),
    [1, 8, 9, 19, 20, 21, 25, 26, 27],
  );

  const overlap = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Sal 23,1-3a.3b-4.5.6'),
  );
  assert.deepStrictEqual(
    overlap.map((v) => v.verse),
    [1, 2, 3, 4, 5, 6],
  );

  const flm = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Flm 7-20'),
  );
  assert.deepStrictEqual(
    flm.map((v) => v.verse),
    [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  );
  assert.ok(flm.every((v) => v.chapter === 0));

  const psalm = cite.collectCitedVerses(
    units,
    cite.parseLectionaryPassage('Sal 15'),
  );
  assert.ok(psalm.length > 1);
  assert.ok(psalm.every((v) => v.chapter === 15));
  assert.strictEqual(psalm[0].verse, 1);

  // Irregular spaces and a period in place of the comma. The source label
  // stays on `display`; the spans are the address Lectura rápida opens.
  const jnSpace = cite.parseBibleCites('Jn , 22');
  const jnDot = cite.parseBibleCites('Jn. 22');
  const jnPlain = cite.parseBibleCites('Jn 22');
  assert.ok(jnSpace && jnDot && jnPlain);
  assert.strictEqual(jnSpace[0].display, 'Jn , 22');
  assert.strictEqual(jnDot[0].display, 'Jn. 22');
  assert.strictEqual(jnSpace[0].code, 'Jn');
  assert.strictEqual(jnSpace[0].spans[0].chapter, 22);
  assert.strictEqual(jnSpace[0].spans[0].start, null);
  assert.deepStrictEqual(jnSpace[0].spans, jnDot[0].spans);
  assert.deepStrictEqual(jnSpace[0].spans, jnPlain[0].spans);
  assert.strictEqual(cite.collectCitedVerses(units, jnSpace[0]).length, 0);
  assert.strictEqual(cite.collectCitedVerses(units, jnDot[0]).length, 0);

  const corpus = path.resolve(
    __dirname,
    '../../../../../documentos/corpus/documents',
  );
  const cic = fs.readFileSync(path.join(corpus, 'cic-es/content.json'), 'utf8');
  const lg = fs.readFileSync(path.join(corpus, 'lg-es/content.json'), 'utf8');
  const aa = fs.readFileSync(path.join(corpus, 'aa-es/content.json'), 'utf8');
  for (const label of [
    'Lc. 2, 22-39',
    'cf. Mc. 1,16-20; 3, 13-19',
    'Ef  5,31-32',
    'Rm 3 ,21-26',
    'cf 1 Tm 4, 3-9; 2 Tm 2 ,22',
  ]) {
    assert.ok(cic.includes(label), label);
  }
  assert.ok(lg.includes('Ml ,1, 11'));
  assert.ok(aa.includes('Jn. 15,4-5'));
  const adPetri = fs.readFileSync(
    path.join(corpus, 'ad-petri-en/content.json'),
    'utf8',
  );
  assert.ok(adPetri.includes('1 Cor. 13.4-7'));

  const lc = cite.collectCitedVerses(
    units,
    cite.parseBibleCites('Lc. 2, 22-39')[0],
  );
  assert.strictEqual(lc.length, 18);
  assert.strictEqual(lc[0].chapter, 2);
  assert.strictEqual(lc[0].verse, 22);
  assert.strictEqual(lc[17].verse, 39);
  assert.ok(lc[0].text.includes('purificación'));

  const mc = cite.parseBibleCites('cf. Mc. 1,16-20; 3, 13-19');
  assert.strictEqual(mc.length, 1);
  assert.deepStrictEqual(
    mc[0].spans.map((s) => [s.chapter, s.start, s.end]),
    [
      [1, 16, 20],
      [3, 13, 19],
    ],
  );
  const mcVerses = cite.collectCitedVerses(units, mc[0]);
  assert.strictEqual(mcVerses[0].verse, 16);
  assert.ok(mcVerses[0].text.includes('Galilea'));
  assert.strictEqual(mcVerses[mcVerses.length - 1].verse, 19);
  assert.strictEqual(mcVerses[mcVerses.length - 1].chapter, 3);

  const ef = cite.collectCitedVerses(
    units,
    cite.parseBibleCites('Ef  5,31-32')[0],
  );
  assert.deepStrictEqual(
    ef.map((v) => v.verse),
    [31, 32],
  );

  const rm = cite.collectCitedVerses(
    units,
    cite.parseBibleCites('Rm 3 ,21-26')[0],
  );
  assert.deepStrictEqual(
    rm.map((v) => v.verse),
    [21, 22, 23, 24, 25, 26],
  );
  assert.ok(rm[0].text.includes('justicia de Dios'));

  const tm = cite.parseBibleCites('cf 1 Tm 4, 3-9; 2 Tm 2 ,22');
  assert.strictEqual(tm.length, 2);
  assert.strictEqual(tm[0].code, '1Tm');
  assert.strictEqual(tm[0].spans[0].start, 3);
  assert.strictEqual(tm[0].spans[0].end, 9);
  assert.strictEqual(tm[1].code, '2Tm');
  assert.strictEqual(tm[1].spans[0].chapter, 2);
  assert.strictEqual(tm[1].spans[0].start, 22);
  const tmVerse = cite.collectCitedVerses(units, tm[1]);
  assert.strictEqual(tmVerse.length, 1);
  assert.strictEqual(tmVerse[0].verse, 22);

  const ml = cite.collectCitedVerses(
    units,
    cite.parseBibleCites('Ml ,1, 11')[0],
  );
  assert.strictEqual(ml.length, 1);
  assert.strictEqual(ml[0].chapter, 1);
  assert.strictEqual(ml[0].verse, 11);
  assert.ok(ml[0].text.includes('Nombre es grande'));

  const jn15 = cite.collectCitedVerses(
    units,
    cite.parseBibleCites('Jn. 15,4-5')[0],
  );
  assert.deepStrictEqual(
    jn15.map((v) => [v.chapter, v.verse]),
    [
      [15, 4],
      [15, 5],
    ],
  );
  assert.ok(jn15[0].text.includes('Permanezcan'));

  const cor = cite.parseBibleCites('1 Cor. 13.4-7');
  assert.strictEqual(cor[0].code, '1Co');
  assert.deepStrictEqual(
    cor[0].spans.map((s) => [s.chapter, s.start, s.end]),
    [[13, 4, 7]],
  );
  const corVerses = cite.collectCitedVerses(units, cor[0]);
  assert.deepStrictEqual(
    corVerses.map((v) => v.verse),
    [4, 5, 6, 7],
  );

  assert.strictEqual(
    cite.parseBibleCites('cf Os 1-3; Is 54.62; Jr 2-3. 31; Ez 16,62;23'),
    null,
  );
  assert.strictEqual(
    cite.parseBibleCites('S. Agustín, De Trinitate, 15,26,47'),
    null,
  );
  assert.strictEqual(cite.parseBibleCites('S.Th. 1, q. 2 a. 3'), null);
  assert.strictEqual(cite.parseBibleCites('12:1'), null);

  console.log('ok bible-cite passage');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
