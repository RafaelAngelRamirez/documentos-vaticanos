/**
 * Packed OLM readings for Lectio (offline).
 * Run: bash ../scripts/node-strip-types.sh src/app/core/liturgia/lecturas-del-dia.logic.test.js
 */
const assert = require('assert');
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

function gospelOf(items) {
  return (items.find((r) => r.role === 'gospel') || {}).cite || null;
}

async function main() {
  const { liturgicalDateOf } = await import(
    pathToFileURL(path.join(__dirname, 'liturgical-date.logic.ts')).href
  );
  const { lecturasForLiturgicalDate } = await import(
    pathToFileURL(path.join(__dirname, 'lecturas-del-dia.logic.ts')).href
  );
  const { parseLectionaryPassage } = await import(
    pathToFileURL(path.join(__dirname, 'bible-cite.logic.ts')).href
  );

  const g = (y, m, d) =>
    gospelOf(lecturasForLiturgicalDate(liturgicalDateOf(new Date(y, m - 1, d))));

  assert.ok(g(2026, 9, 11), 'OT Friday 11 Sep 2026 has a gospel');
  assert.match(g(2026, 9, 11), /Lc 6,39-42/);

  assert.match(g(2026, 2, 18), /Mt 6,1-6/);
  assert.match(g(2026, 4, 5), /Jn 20,1-9/);
  assert.match(g(2026, 12, 25), /Lc 2,1-14/);
  assert.match(g(2026, 3, 29), /Mt 26,14/);
  assert.match(g(2025, 11, 30), /Mt 24,37-44/);
  assert.match(g(2026, 2, 22), /Mt 4,1-11/);
  assert.match(g(2026, 5, 24), /Jn 20,19-23/);
  assert.match(g(2026, 1, 6), /Mt 2,1-12/);
  assert.match(g(2026, 12, 8), /Lc 1,26-38/);

  const sunday = (week, cycle) =>
    gospelOf(
      lecturasForLiturgicalDate({
        season: 'ordinary',
        week,
        weekday: 0,
        sundayCycle: cycle,
        weekdayYear: 'I',
        month: 1,
        day: 1,
      }),
    );

  assert.match(sunday(7, 'B'), /Mc 2,1-12/);
  assert.match(sunday(8, 'B'), /Mc 2,18-22/);
  assert.match(sunday(9, 'A'), /Mt 7,21-27/);
  assert.match(sunday(9, 'B'), /Mc 2,23/);
  assert.match(sunday(10, 'A'), /Mt 9,9-13/);
  assert.match(sunday(10, 'C'), /Lc 7,11-17/);
  assert.match(sunday(11, 'C'), /Lc 7,36/);
  assert.match(sunday(12, 'C'), /Lc 9,18-24/);

  assert.match(g(2026, 5, 31), /Jn 3,16-18/, 'Trinity A');
  assert.match(g(2026, 6, 7), /Jn 6,51-58/, 'Corpus A');
  assert.match(g(2027, 5, 16), /Jn 15,26-27/, 'Pentecost B');
  assert.match(g(2028, 6, 4), /Jn 14,15-16/, 'Pentecost C');
  assert.match(g(2027, 3, 21), /Mc 14,1/, 'Palm B');
  assert.match(g(2028, 4, 9), /Lc 22,14/, 'Palm C');

  assert.match(g(2026, 3, 19), /Mt 1,16/, 'St Joseph replaces the Lenten feria');
  assert.strictEqual(liturgicalDateOf(new Date(2026, 2, 19)).feast, 'joseph');
  assert.match(g(2026, 3, 25), /Lc 1,26-38/, 'Annunciation replaces the Lenten feria');
  assert.doesNotMatch(g(2026, 3, 18), /Mt 1,16/);
  assert.notStrictEqual(liturgicalDateOf(new Date(2023, 2, 19)).feast, 'joseph');
  assert.doesNotMatch(g(2023, 3, 19), /Mt 1,16/, 'Sunday of Lent keeps the Sunday');
  assert.notStrictEqual(liturgicalDateOf(new Date(2008, 2, 19)).feast, 'joseph');
  assert.match(g(2008, 3, 19), /Mt 26,14/, 'Holy Week feria outranks St Joseph');
  assert.match(g(2026, 6, 24), /Lc 1,57-66/);
  assert.match(g(2026, 6, 29), /Mt 16,13-19/);
  assert.match(g(2026, 8, 6), /Mt 17,1-9/, 'Transfiguration A');
  assert.match(g(2027, 8, 6), /Mc 9,2-10/, 'Transfiguration B');
  assert.match(g(2028, 8, 6), /Lc 9,28/, 'Transfiguration C');
  assert.match(g(2026, 9, 14), /Jn 3,13-17/);
  assert.match(g(2026, 11, 2), /Jn 6,37-40/, 'All Souls replaces the feria');
  assert.match(g(2025, 11, 2), /Lc 19,1-10/, 'OT Sunday 31 C outranks All Souls');
  assert.notStrictEqual(liturgicalDateOf(new Date(2025, 10, 2)).feast, 'all-souls');
  assert.notStrictEqual(
    liturgicalDateOf(new Date(2025, 10, 3)).feast,
    'all-souls',
    'All Souls is not transferred to Monday',
  );
  assert.match(g(2025, 12, 27), /Jn 20,2-8/, 'St John replaces the octave feria');
  assert.match(g(2026, 12, 27), /Lc 2,22-40/, 'Holy Family keeps the Sunday');

  const advI = g(2025, 12, 1);
  const advII = g(2026, 11, 30);
  assert.match(advI, /Mt 8,5-11/, 'Advent feria, weekday year I');
  assert.strictEqual(advII, advI, 'Advent feria ignores weekday year II');
  assert.doesNotMatch(advI, /Mc 1,14-20/);
  assert.strictEqual(
    liturgicalDateOf(new Date(2025, 11, 1)).weekdayYear,
    'I',
  );
  assert.strictEqual(
    liturgicalDateOf(new Date(2026, 10, 30)).weekdayYear,
    'II',
  );

  const parsed = [
    'Mc 2,23–3,6',
    'Lc 7,36–8,3',
    'Za 12,10-11;13,1',
    'Jn 15,26-27;16,12-15',
    'Jn 14,15-16.23b-26',
    'Mc 14,1 – 15,47',
    'Lc 22,14 – 23,56',
    'Mt 1,16.18-21.24a',
    'Is 7,10-14;8,10',
    '2S 7,4-5a.12-14a.16',
    '1R 17,17-24',
    'Flp 2,6-11',
    'Dn 3,52.53.54.55.56',
  ];
  for (const cite of parsed) {
    const passage = parseLectionaryPassage(cite);
    assert.ok(passage && passage.spans.length, cite);
  }

  const ash = liturgicalDateOf(new Date(2026, 1, 18));
  assert.strictEqual(ash.season, 'lent');
  assert.strictEqual(ash.week, 0);
  assert.strictEqual(ash.feast, 'ash-wednesday');

  const easter = liturgicalDateOf(new Date(2026, 3, 5));
  assert.strictEqual(easter.feast, 'easter');

  console.log('ok lecturas-del-dia');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
