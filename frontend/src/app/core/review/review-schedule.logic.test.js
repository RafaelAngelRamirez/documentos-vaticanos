/**
 * SM-2 local. La facilidad sube con calidad 5 y no baja si la calidad es menor que 3.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/review/review-schedule.logic.test.js
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function main() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, 'review-schedule.logic.ts')).href
  );
  const {
    REVIEW_DEFAULT_EASE,
    REVIEW_GRADE,
    REVIEW_MIN_EASE,
    addIsoDays,
    formatReviewEase,
    freshReviewSchedule,
    localIsoDay,
    scheduleReview,
    selectDueReviews,
  } = mod;

  const today = '2026-10-27';
  const fresh = freshReviewSchedule(today);
  assert.strictEqual(fresh.ease, REVIEW_DEFAULT_EASE);
  assert.strictEqual(REVIEW_GRADE.again, 1);
  assert.strictEqual(REVIEW_GRADE.good, 4);
  assert.strictEqual(REVIEW_GRADE.easy, 5);

  assert.strictEqual(localIsoDay(new Date(2026, 9, 27, 23, 59)), '2026-10-27');
  assert.strictEqual(formatReviewEase(2.5), '2.50');
  assert.strictEqual(formatReviewEase(2.6), '2.60');

  let card = scheduleReview(fresh, REVIEW_GRADE.good, today);
  assert.strictEqual(card.ease, 2.5);
  assert.strictEqual(card.intervalDays, 1);
  assert.strictEqual(card.reps, 1);
  card = scheduleReview(card, REVIEW_GRADE.good, card.due);
  assert.strictEqual(card.ease, 2.5);
  assert.strictEqual(card.intervalDays, 6);
  card = scheduleReview(card, REVIEW_GRADE.good, card.due);
  assert.strictEqual(card.ease, 2.5);
  assert.strictEqual(card.intervalDays, 15);

  let easy = freshReviewSchedule(today);
  easy = scheduleReview(easy, REVIEW_GRADE.easy, today);
  assert.strictEqual(easy.ease, 2.6);
  assert.ok(easy.ease > REVIEW_DEFAULT_EASE);
  easy = scheduleReview(easy, REVIEW_GRADE.easy, easy.due);
  assert.strictEqual(easy.ease, 2.7);
  assert.strictEqual(easy.intervalDays, 6);

  let hard = freshReviewSchedule(today);
  for (let i = 0; i < 3; i++) {
    hard = scheduleReview(hard, REVIEW_GRADE.again, today);
  }
  assert.strictEqual(hard.ease, REVIEW_DEFAULT_EASE);
  assert.strictEqual(hard.reps, 0);
  assert.strictEqual(hard.intervalDays, 1);
  assert.notStrictEqual(hard.ease, REVIEW_MIN_EASE);

  const dipped = scheduleReview(
    { ease: REVIEW_MIN_EASE, intervalDays: 6, reps: 2, due: today },
    3,
    today,
  );
  assert.strictEqual(dipped.ease, REVIEW_MIN_EASE);
  const raised = scheduleReview(dipped, REVIEW_GRADE.easy, dipped.due);
  assert.strictEqual(raised.ease, 1.4);
  assert.ok(raised.ease > dipped.ease);

  const clamped = scheduleReview(fresh, 6, today);
  assert.strictEqual(clamped.ease, 2.6);
  const nan = scheduleReview(fresh, Number.NaN, today);
  assert.strictEqual(nan.ease, REVIEW_DEFAULT_EASE);
  assert.strictEqual(nan.reps, 0);

  assert.strictEqual(addIsoDays('2024-02-28', 1), '2024-02-29');
  assert.strictEqual(addIsoDays('2024-02-28', 2), '2024-03-01');
  assert.strictEqual(addIsoDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addIsoDays('no-es-fecha', 3), 'no-es-fecha');

  const source = [
    { id: 'later', due: '2026-10-28' },
    { id: 'old', due: '2026-10-20' },
    { id: 'today', due: today },
    { id: 'older', due: '2026-10-01' },
  ];
  const queue = selectDueReviews(source, today, 2);
  assert.deepStrictEqual(
    queue.map((row) => row.id),
    ['older', 'old'],
  );
  assert.strictEqual(source[0].id, 'later');
  assert.strictEqual(selectDueReviews([{ id: 'a', due: today }], today, 0).length, 0);

  console.log('review-schedule.logic.test: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
