/**
 * Cola de repaso sobre notas y marcadores ya guardados.
 * No crea fichas nuevas: si no hay nota o marcador, no hay nada que repasar.
 */
import {
  REVIEW_GRADE,
  freshReviewSchedule,
  isReviewDue,
  scheduleReview,
  selectDueReviews,
} from './review-schedule.logic';
import type { ReviewSchedule } from './review-schedule.logic';

export const REVIEW_STORAGE_KEY = 'dv_repaso_v1';

export type ReviewButton = 'again' | 'good' | 'easy';

export type ReviewScheduleMap = Record<string, ReviewSchedule>;

export interface ReviewMark {
  id: string;
  documentId: string;
  unitIndex: number;
  unitLabel?: string;
  excerpt?: string;
  nota?: string;
  kind: string;
}

export interface ReviewCard {
  id: string;
  kind: 'nota' | 'marcador';
  documentId: string;
  unitIndex: number;
  unitLabel: string;
  excerpt: string;
  nota: string;
  due: string;
  ease: number;
  intervalDays: number;
  reps: number;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isSchedule(value: unknown): value is ReviewSchedule {
  if (!value || typeof value !== 'object') return false;
  const row = value as ReviewSchedule;
  return (
    typeof row.ease === 'number' &&
    Number.isFinite(row.ease) &&
    typeof row.intervalDays === 'number' &&
    Number.isFinite(row.intervalDays) &&
    typeof row.reps === 'number' &&
    Number.isFinite(row.reps) &&
    typeof row.due === 'string' &&
    ISO_DAY.test(row.due)
  );
}

export function parseReviewStore(raw: string | null | undefined): ReviewScheduleMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ReviewScheduleMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (!id || !isSchedule(value)) continue;
      out[id] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Notas y marcadores con id. Un subrayado no entra en la cola. */
export function reviewableMarks(
  marks: readonly ReviewMark[] | null | undefined,
): ReviewMark[] {
  if (!Array.isArray(marks)) return [];
  return marks.filter(
    (mark) =>
      !!mark &&
      (mark.kind === 'nota' || mark.kind === 'marcador') &&
      typeof mark.id === 'string' &&
      mark.id.length > 0 &&
      typeof mark.documentId === 'string' &&
      mark.documentId.length > 0 &&
      Number.isInteger(mark.unitIndex) &&
      mark.unitIndex >= 0,
  );
}

function scheduleFor(
  stored: ReviewScheduleMap,
  id: string,
  today: string,
): ReviewSchedule {
  const raw = stored[id];
  if (!raw || !isSchedule(raw)) return freshReviewSchedule(today);
  return raw;
}

function toCard(mark: ReviewMark, schedule: ReviewSchedule): ReviewCard {
  const kind = mark.kind === 'marcador' ? 'marcador' : 'nota';
  return {
    id: mark.id,
    kind,
    documentId: mark.documentId,
    unitIndex: mark.unitIndex,
    unitLabel: mark.unitLabel || mark.documentId,
    excerpt: mark.excerpt || '',
    nota: mark.nota || '',
    due: schedule.due,
    ease: schedule.ease,
    intervalDays: schedule.intervalDays,
    reps: schedule.reps,
  };
}

export function reviewCards(
  marks: readonly ReviewMark[] | null | undefined,
  stored: ReviewScheduleMap,
  today: string,
): ReviewCard[] {
  return reviewableMarks(marks).map((mark) =>
    toCard(mark, scheduleFor(stored, mark.id, today)),
  );
}

/** Las que tocan hoy, la más atrasada primero. */
export function dueReviewCards(
  marks: readonly ReviewMark[] | null | undefined,
  stored: ReviewScheduleMap,
  today: string,
): ReviewCard[] {
  const cards = reviewCards(marks, stored, today);
  return selectDueReviews(cards, today, cards.length);
}

/** Primer día futuro entre las fichas que siguen guardadas. */
export function nextReviewDay(
  marks: readonly ReviewMark[] | null | undefined,
  stored: ReviewScheduleMap,
  today: string,
): string | null {
  const future = reviewCards(marks, stored, today)
    .map((card) => card.due)
    .filter((due) => !isReviewDue(due, today))
    .sort();
  return future[0] ?? null;
}

export function gradeReview(
  stored: ReviewScheduleMap,
  markId: string,
  quality: number,
  today: string,
): { map: ReviewScheduleMap; schedule: ReviewSchedule } {
  const schedule = scheduleReview(scheduleFor(stored, markId, today), quality, today);
  return {
    map: { ...stored, [markId]: schedule },
    schedule,
  };
}

/** El mismo botón que pinta la pantalla: otra vez, la sé, fácil. */
export function pressReviewButton(
  stored: ReviewScheduleMap,
  markId: string,
  button: ReviewButton,
  today: string,
): { map: ReviewScheduleMap; schedule: ReviewSchedule } {
  const quality =
    button === 'easy'
      ? REVIEW_GRADE.easy
      : button === 'good'
        ? REVIEW_GRADE.good
        : REVIEW_GRADE.again;
  return gradeReview(stored, markId, quality, today);
}
