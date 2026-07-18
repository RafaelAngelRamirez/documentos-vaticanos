/**
 * Real unit tests for shipped santoral-calendar.logic.ts
 * Run: node --experimental-strip-types frontend/src/app/core/santoral/santoral-calendar.logic.test.js
 *  or: npx ts-node --transpile-only (via scripts-descarga wrapper)
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

const LOGIC = path.join(__dirname, 'santoral-calendar.logic.ts');

async function main() {
  const mod = await import(pathToFileURL(LOGIC).href + `?t=${Date.now()}`);

  const fixtures = [
    {
      id: 'bruno-de-segni',
      name: 'Bruno de Segni',
      displayName: 'San Bruno de Segni',
      feastDays: ['07-18'],
    },
    {
      id: 'bruno-de-calabria',
      name: 'Bruno de Calabria',
      feastDays: ['10-06'],
    },
    {
      id: 'no-feast',
      name: 'Sin Fiesta',
      // no feastDays — must not appear on calendar days
    },
    {
      id: 'multi-day',
      name: 'Multi Día',
      feastDays: ['07-18', '01-01'],
    },
    {
      id: 'bad-feast',
      name: 'Malo',
      feastDays: ['99-99', 'not-a-date'],
    },
  ];

  // year structure
  const year = mod.yearMonthSummaries(fixtures);
  assert.strictEqual(year.length, 12, 'year has 12 months');
  assert.strictEqual(year[0].label, 'Enero');
  assert.strictEqual(year[6].mm, '07');
  assert.ok(year[6].daysWithSaints >= 1, 'July has days with saints');
  assert.ok(year[6].saintEntries >= 2, 'July has Bruno + multi');

  // month 07 includes day 18 with Bruno
  const july = mod.monthDayCells(fixtures, 7);
  assert.strictEqual(july.length, 31);
  const d18 = july.find((c) => c.day === 18);
  assert.ok(d18, 'day 18 cell');
  assert.strictEqual(d18.feastKey, '07-18');
  assert.ok(d18.saintCount >= 2);
  assert.ok(d18.saints.some((s) => s.id === 'bruno-de-segni'));
  assert.ok(d18.saints.some((s) => s.id === 'multi-day'));
  assert.ok(!d18.saints.some((s) => s.id === 'bruno-de-calabria'));
  assert.ok(!d18.saints.some((s) => s.id === 'no-feast'));

  // day list API
  const dayList = mod.saintsForDay(fixtures, '07-18');
  assert.ok(dayList.some((s) => s.id === 'bruno-de-segni'));
  assert.ok(!dayList.some((s) => s.id === 'bruno-de-calabria'));
  assert.ok(!dayList.some((s) => s.id === 'no-feast'));
  assert.ok(!dayList.some((s) => s.id === 'bad-feast'));

  const emptyDay = mod.saintsForDay(fixtures, '03-15');
  assert.strictEqual(emptyDay.length, 0, 'empty day invents nothing');

  const emptyPack = mod.saintsForDay([], '07-18');
  assert.strictEqual(emptyPack.length, 0);

  // normalize
  assert.strictEqual(mod.normalizeFeastDay('7-18'), '07-18');
  assert.strictEqual(mod.normalizeFeastDay('07/18'), '07-18');
  assert.strictEqual(mod.normalizeFeastDay('99-01'), null);
  assert.strictEqual(mod.normalizeFeastDay(''), null);

  // Oct 6 Calabria only
  const oct = mod.saintsForDay(fixtures, 10, 6);
  assert.strictEqual(oct.length, 1);
  assert.strictEqual(oct[0].id, 'bruno-de-calabria');

  console.log('ok santoral-calendar-logic');
  console.log(
    JSON.stringify({
      yearMonths: year.length,
      julyDays: july.length,
      day0718: dayList.map((s) => s.id),
      empty0315: emptyDay.length,
      oct6: oct.map((s) => s.id),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
