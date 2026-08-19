/**
 * Run: node --experimental-strip-types frontend/src/app/core/liturgia/liturgical-date.logic.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const dateMod = await import(
    pathToFileURL(path.join(__dirname, 'liturgical-date.logic.ts')).href
  );
  const citeMod = await import(
    pathToFileURL(path.join(__dirname, 'bible-cite.logic.ts')).href
  );

  const e = dateMod.easterSunday(2026);
  assert.strictEqual(e.getUTCMonth() + 1, 4);
  assert.strictEqual(e.getUTCDate(), 5);

  const d = dateMod.liturgicalDateOf(new Date(2026, 7, 18));
  assert.strictEqual(d.season, 'ordinary');
  assert.strictEqual(d.week, 20);
  assert.strictEqual(d.weekday, 2);
  assert.strictEqual(d.weekdayYear, 'II');
  assert.strictEqual(d.sundayCycle, 'A');

  const wd = fs.readFileSync(
    path.join(__dirname, 'ot-weekday-lectionary.ts'),
    'utf8',
  );
  assert.ok(/Mt 19,23-30/.test(wd), 'week 20 Tuesday gospel');
  assert.ok(/Ez 28,1-10/.test(wd), 'week 20 Tuesday year II first');

  const parsed = citeMod.parseLectionaryCite('Mt 19,23-30');
  assert.strictEqual(parsed.code, 'Mt');
  assert.strictEqual(parsed.chapter, '19');
  assert.strictEqual(parsed.verse, 23);
  const idx = citeMod.findBibleUnitIndex(
    [
      {
        biblia: {
          libro: 'evangelio segun san mateo',
          capitulo: '19',
          versiculo: 23,
        },
        index_array: 42,
      },
    ],
    parsed,
  );
  assert.strictEqual(idx, 42);

  console.log('ok liturgical-date + cite');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
