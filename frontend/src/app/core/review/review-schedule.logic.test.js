/**
 * SM-2 local para el repaso offline.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/review/review-schedule.logic.test.js
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
          } catch {
            // fall through
          }
        }
        return nextResolve(specifier, context);
      }
    `),
  pathToFileURL(__filename),
);

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'review-schedule.logic.ts')).href
  );
  const {
    REVIEW_DEFAULT_EASE,
    REVIEW_GRADE,
    REVIEW_MIN_EASE,
    addIsoDays,
    freshReviewSchedule,
    isReviewDue,
    scheduleReview,
    selectDueReviews,
  } = mod;

  const today = '2026-10-26';
  const fresh = freshReviewSchedule(today);
  assert.strictEqual(fresh.ease, REVIEW_DEFAULT_EASE);
  assert.strictEqual(fresh.intervalDays, 0);
  assert.strictEqual(fresh.reps, 0);
  assert.strictEqual(fresh.due, today);
  assert.strictEqual(isReviewDue(fresh.due, today), true);
  assert.strictEqual(isReviewDue('2026-10-27', today), false);

  assert.strictEqual(REVIEW_GRADE.again, 1);
  assert.strictEqual(REVIEW_GRADE.good, 4);

  // Tres «la sé» (calidad 4): el factor no cambia; intervalos 1, 6, 15.
  let card = scheduleReview(fresh, REVIEW_GRADE.good, today);
  assert.deepStrictEqual(
    { ease: card.ease, intervalDays: card.intervalDays, reps: card.reps, due: card.due },
    { ease: 2.5, intervalDays: 1, reps: 1, due: '2026-10-27' },
  );
  card = scheduleReview(card, REVIEW_GRADE.good, card.due);
  assert.deepStrictEqual(
    { ease: card.ease, intervalDays: card.intervalDays, reps: card.reps, due: card.due },
    { ease: 2.5, intervalDays: 6, reps: 2, due: '2026-11-02' },
  );
  card = scheduleReview(card, REVIEW_GRADE.good, card.due);
  assert.deepStrictEqual(
    { ease: card.ease, intervalDays: card.intervalDays, reps: card.reps, due: card.due },
    { ease: 2.5, intervalDays: 15, reps: 3, due: '2026-11-17' },
  );

  // Calidad 5 sube el factor después de fijar el intervalo con el factor viejo.
  let easy = freshReviewSchedule(today);
  easy = scheduleReview(easy, 5, today);
  assert.strictEqual(easy.intervalDays, 1);
  assert.strictEqual(easy.ease, 2.6);
  easy = scheduleReview(easy, 5, easy.due);
  assert.strictEqual(easy.intervalDays, 6);
  assert.strictEqual(easy.ease, 2.7);
  easy = scheduleReview(easy, 5, easy.due);
  assert.strictEqual(easy.intervalDays, 16);
  assert.strictEqual(easy.reps, 3);
  assert.strictEqual(easy.ease, 2.8);

  // «Otra vez» reinicia y deja el factor en el suelo.
  let hard = freshReviewSchedule(today);
  for (let i = 0; i < 8; i++) {
    hard = scheduleReview(hard, REVIEW_GRADE.again, today);
  }
  assert.strictEqual(hard.reps, 0);
  assert.strictEqual(hard.intervalDays, 1);
  assert.strictEqual(hard.due, '2026-10-27');
  assert.ok(hard.ease >= REVIEW_MIN_EASE);
  assert.strictEqual(hard.ease, REVIEW_MIN_EASE);

  // Calidad fuera de rango se acota. 6 cuenta como 5.
  const clamped = scheduleReview(fresh, 6, today);
  assert.strictEqual(clamped.ease, 2.6);
  assert.strictEqual(clamped.intervalDays, 1);
  const nan = scheduleReview(fresh, Number.NaN, today);
  assert.strictEqual(nan.reps, 0);
  assert.strictEqual(nan.intervalDays, 1);

  assert.strictEqual(addIsoDays('2024-02-28', 1), '2024-02-29');
  assert.strictEqual(addIsoDays('2024-02-28', 2), '2024-03-01');
  assert.strictEqual(addIsoDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addIsoDays('no-es-fecha', 3), 'no-es-fecha');

  const queue = selectDueReviews(
    [
      { id: 'later', due: '2026-10-27' },
      { id: 'old', due: '2026-10-20' },
      { id: 'today', due: '2026-10-26' },
      { id: 'older', due: '2026-10-01' },
    ],
    today,
    2,
  );
  assert.deepStrictEqual(
    queue.map((c) => c.id),
    ['older', 'old'],
  );
  assert.strictEqual(selectDueReviews([{ id: 'a', due: today }], today, 0).length, 0);

  console.log('review-schedule.logic.test: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
