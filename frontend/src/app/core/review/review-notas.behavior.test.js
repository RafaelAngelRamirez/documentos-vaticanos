/**
 * Repaso de una nota y un marcador ya guardados.
 * Los botones son los de la pantalla: otra vez, la sé, fácil.
 * Run: bash ../scripts/node-strip-types.sh src/app/core/review/review-notas.behavior.test.js
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

function section(name) {
  console.log(`\n== ${name} ==`);
}

async function main() {
  const queue = await import(
    pathToFileURL(path.join(__dirname, 'review-queue.logic.ts')).href
  );
  const schedule = await import(
    pathToFileURL(path.join(__dirname, 'review-schedule.logic.ts')).href
  );
  const {
    dueReviewCards,
    nextReviewDay,
    parseReviewStore,
    pressReviewButton,
    reviewableMarks,
  } = queue;
  const { REVIEW_DEFAULT_EASE, formatReviewEase } = schedule;

  const today = '2026-10-27';
  const note = {
    id: 'nota-dv',
    documentId: 'dei-verbum-es',
    unitIndex: 12,
    unitLabel: 'Dei Verbum 12',
    excerpt: 'la Escritura se ha de leer e interpretar',
    nota: 'volver a este párrafo',
    kind: 'nota',
  };
  const bookmark = {
    id: 'marca-dv',
    documentId: 'lg-es',
    unitIndex: 4,
    unitLabel: 'Lumen gentium 4',
    excerpt: '',
    kind: 'marcador',
  };
  const highlight = {
    id: 'sub-dv',
    documentId: 'dei-verbum-es',
    unitIndex: 2,
    excerpt: 'un subrayado no se repasa',
    kind: 'subrayado',
  };
  const marks = [note, bookmark, highlight];

  section('hoy tocan la nota y el marcador');
  assert.strictEqual(reviewableMarks(marks).length, 2);
  let stored = {};
  let due = dueReviewCards(marks, stored, today);
  assert.deepStrictEqual(
    due.map((card) => card.id),
    ['nota-dv', 'marca-dv'],
  );
  assert.strictEqual(due[0].ease, REVIEW_DEFAULT_EASE);
  assert.strictEqual(formatReviewEase(due[0].ease), '2.50');
  assert.strictEqual(due[0].excerpt, note.excerpt);
  assert.strictEqual(due[0].nota, note.nota);
  assert.strictEqual(due[1].kind, 'marcador');
  assert.strictEqual(due[1].unitLabel, 'Lumen gentium 4');
  const dueSnapshot = due.map((card) => card.id);

  section('fácil sube la facilidad');
  let pressed = pressReviewButton(stored, due[0].id, 'easy', today);
  assert.strictEqual(pressed.schedule.ease, 2.6);
  assert.ok(pressed.schedule.ease > due[0].ease);
  assert.strictEqual(formatReviewEase(pressed.schedule.ease), '2.60');
  assert.strictEqual(pressed.schedule.intervalDays, 1);
  assert.strictEqual(pressed.schedule.reps, 1);
  assert.strictEqual(pressed.schedule.due, '2026-10-28');
  assert.strictEqual(stored['nota-dv'], undefined);
  stored = pressed.map;
  due = dueReviewCards(marks, stored, today);
  assert.deepStrictEqual(
    due.map((card) => card.id),
    ['marca-dv'],
  );
  assert.deepStrictEqual(dueSnapshot, ['nota-dv', 'marca-dv']);

  section('otra vez no baja la facilidad');
  const easeBeforeAgain = due[0].ease;
  pressed = pressReviewButton(stored, due[0].id, 'again', today);
  assert.strictEqual(pressed.schedule.ease, easeBeforeAgain);
  assert.strictEqual(pressed.schedule.ease, 2.5);
  assert.strictEqual(pressed.schedule.reps, 0);
  assert.strictEqual(pressed.schedule.intervalDays, 1);
  assert.strictEqual(pressed.schedule.due, '2026-10-28');
  stored = pressed.map;
  assert.strictEqual(dueReviewCards(marks, stored, today).length, 0);
  assert.strictEqual(nextReviewDay(marks, stored, today), '2026-10-28');

  section('al día siguiente fácil vuelve a subir');
  const tomorrow = '2026-10-28';
  due = dueReviewCards(marks, stored, tomorrow);
  assert.deepStrictEqual(
    due.map((card) => card.id),
    ['nota-dv', 'marca-dv'],
  );
  assert.strictEqual(due[0].ease, 2.6);
  pressed = pressReviewButton(stored, due[0].id, 'easy', tomorrow);
  assert.strictEqual(pressed.schedule.ease, 2.7);
  assert.strictEqual(pressed.schedule.intervalDays, 6);
  assert.strictEqual(pressed.schedule.due, '2026-11-03');
  stored = pressed.map;

  section('la sé no mueve la facilidad');
  pressed = pressReviewButton(stored, 'marca-dv', 'good', tomorrow);
  assert.strictEqual(pressed.schedule.ease, 2.5);
  assert.strictEqual(pressed.schedule.intervalDays, 1);
  stored = pressed.map;
  pressed = pressReviewButton(stored, 'marca-dv', 'good', pressed.schedule.due);
  assert.strictEqual(pressed.schedule.ease, 2.5);
  assert.strictEqual(pressed.schedule.intervalDays, 6);
  stored = pressed.map;

  section('tres otra vez no clavan el factor en el suelo');
  let stuck = {};
  for (let i = 0; i < 3; i++) {
    stuck = pressReviewButton(stuck, note.id, 'again', today).map;
  }
  assert.strictEqual(stuck[note.id].ease, 2.5);
  const lifted = pressReviewButton(stuck, note.id, 'easy', today);
  assert.strictEqual(lifted.schedule.ease, 2.6);

  section('un factor ya en el mínimo puede subir');
  const floored = parseReviewStore(
    JSON.stringify({
      [note.id]: { ease: 1.3, intervalDays: 1, reps: 0, due: today },
      basura: { ease: 'no' },
      [highlight.id]: { ease: 2.5, intervalDays: 1, reps: 1, due: today },
    }),
  );
  assert.strictEqual(floored.basura, undefined);
  assert.strictEqual(floored[highlight.id].ease, 2.5);
  const fromFloor = pressReviewButton(floored, note.id, 'easy', today);
  assert.strictEqual(fromFloor.schedule.ease, 1.4);
  const stillHidden = dueReviewCards(marks, fromFloor.map, today).map(
    (card) => card.id,
  );
  assert.ok(!stillHidden.includes(highlight.id));

  section('sin la nota, el horario no la vuelve a sacar');
  const onlyBookmark = dueReviewCards([bookmark], fromFloor.map, today);
  assert.deepStrictEqual(
    onlyBookmark.map((card) => card.id),
    ['marca-dv'],
  );
  assert.deepStrictEqual(parseReviewStore('no-json'), {});
  assert.deepStrictEqual(parseReviewStore(null), {});

  console.log('\nreview-notas.behavior.test: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
