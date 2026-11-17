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
  assert.ok(apVerses[0].text.includes('Sardes'));
  assert.ok(apVerses.find((v) => v.verse === 14).text.includes('Laodicea'));
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

  console.log('ok bible-cite passage');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
