/**
 * Repaso espaciado en el aparato. SM-2 (Piotr Wozniak, dominio público).
 *
 * El día es calendario local `YYYY-MM-DD`. Quien llama lo calcula.
 * El intervalo usa el factor anterior. El factor nuevo vale la vez siguiente.
 * Calidad menor que 3 reinicia el intervalo y no toca la facilidad.
 * Calidad 5 la sube. Calidad 4 la deja igual.
 */

export const REVIEW_MIN_EASE = 1.3;
export const REVIEW_DEFAULT_EASE = 2.5;

/**
 * Botones de la pantalla de repaso, en la escala SM-2 (0–5).
 * Otra vez = 1 (reinicia, la facilidad no baja).
 * La sé = 4 (sigue el intervalo, la facilidad no cambia).
 * Fácil = 5 (sigue el intervalo y la facilidad sube).
 */
export const REVIEW_GRADE = {
  again: 1,
  good: 4,
  easy: 5,
} as const;

export interface ReviewSchedule {
  /** Factor de facilidad. Nunca baja de 1.3. */
  ease: number;
  /** Intervalo en días tras la última calificación. 0 si es nueva. */
  intervalDays: number;
  /** Aciertos seguidos con calidad ≥ 3. */
  reps: number;
  /** Próximo día inclusive, `YYYY-MM-DD`. */
  due: string;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function freshReviewSchedule(today: string): ReviewSchedule {
  return {
    ease: REVIEW_DEFAULT_EASE,
    intervalDays: 0,
    reps: 0,
    due: today,
  };
}

/** Día local del aparato, `YYYY-MM-DD`. */
export function localIsoDay(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calidad SM-2 entera, acotada a 0–5. */
export function clampReviewQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0;
  return Math.min(5, Math.max(0, Math.round(quality)));
}

/**
 * Suma días de calendario. Fechas inválidas se devuelven igual.
 * UTC para que el día no dependa de la zona al cruzar la medianoche.
 */
export function addIsoDays(isoDate: string, days: number): string {
  const match = ISO_DAY.exec(isoDate);
  if (!match || !Number.isFinite(days)) return isoDate;
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(utc.getTime())) return isoDate;
  utc.setUTCDate(utc.getUTCDate() + Math.trunc(days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function roundReviewEase(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Dos decimales, para mostrar que el factor se movió (2.50 → 2.60). */
export function formatReviewEase(ease: number): string {
  if (!Number.isFinite(ease)) return '';
  return roundReviewEase(ease).toFixed(2);
}

function easeFloor(ease: number): number {
  if (!Number.isFinite(ease)) return REVIEW_DEFAULT_EASE;
  return Math.max(REVIEW_MIN_EASE, ease);
}

/**
 * Un paso SM-2.
 * Calidad menor que 3: repeticiones a cero, intervalo de 1 día, facilidad igual.
 */
export function scheduleReview(
  state: ReviewSchedule,
  quality: number,
  today: string,
): ReviewSchedule {
  const q = clampReviewQuality(quality);
  const previousEase = easeFloor(state.ease);

  let reps: number;
  let intervalDays: number;
  if (q >= 3) {
    reps = state.reps + 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(state.intervalDays * previousEase));
  } else {
    reps = 0;
    intervalDays = 1;
  }

  let ease = previousEase;
  if (q >= 3) {
    ease = previousEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (ease < REVIEW_MIN_EASE) ease = REVIEW_MIN_EASE;
  }

  return {
    ease: roundReviewEase(ease),
    intervalDays,
    reps,
    due: addIsoDays(today, intervalDays),
  };
}

/** `due` y `today` son `YYYY-MM-DD`. El orden lexicográfico coincide con el calendario. */
export function isReviewDue(due: string, today: string): boolean {
  return due <= today;
}

/** Vencidas, la más antigua primero. No muta la lista. */
export function selectDueReviews<T extends { due: string }>(
  cards: readonly T[],
  today: string,
  limit: number,
): T[] {
  const n = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return cards
    .map((card, index) => ({ card, index }))
    .filter((row) => isReviewDue(row.card.due, today))
    .sort(
      (a, b) => a.card.due.localeCompare(b.card.due) || a.index - b.index,
    )
    .slice(0, n)
    .map((row) => row.card);
}
