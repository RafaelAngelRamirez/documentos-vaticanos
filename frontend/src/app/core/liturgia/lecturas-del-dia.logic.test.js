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

  // Packed OLM omits OT Sunday 8 cycle B; cycleRow falls back to A (Mt 6,24-34).
  const ot8b = lecturasForLiturgicalDate({
    season: 'ordinary',
    week: 8,
    weekday: 0,
    sundayCycle: 'B',
    weekdayYear: 'II',
    month: 5,
    day: 27,
  });
  assert.match(
    gospelOf(ot8b),
    /Mt 6,24-34/,
    'OT Sunday 8 B missing in pack → A fallback',
  );

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
