/** Umbral de descarte por distancia (px) y por velocidad (px/ms). */
export const SHEET_DISMISS_DISTANCE = 80;
export const SHEET_DISMISS_VELOCITY = 0.5;
/** Por debajo de esto el gesto sigue siendo un toque. */
export const SHEET_DRAG_SLOP = 10;

export type SheetGesturePhase = 'pending' | 'drag' | 'scroll';

export interface SheetGestureState {
  phase: SheetGesturePhase;
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  /** null si el gesto no nació dentro de un scroller vertical. */
  scrollTop: number | null;
  /** Desplazamiento hacia abajo ya reclamado por la hoja. */
  y: number;
}

export function sheetGestureBegin(input: {
  pointerId: number;
  x: number;
  y: number;
  time: number;
  scrollTop: number | null;
  fromGrab: boolean;
  fromField: boolean;
}): SheetGestureState | null {
  if (input.fromField && !input.fromGrab) return null;
  return {
    phase: input.fromGrab ? 'drag' : 'pending',
    pointerId: input.pointerId,
    startX: input.x,
    startY: input.y,
    startTime: input.time,
    scrollTop: input.fromGrab ? null : input.scrollTop,
    y: 0,
  };
}

/**
 * Primer movimiento que pasa el slop fija la fase.
 * Hacia abajo, con el scroller arriba (o sin scroller), la hoja sigue el dedo.
 * Hacia abajo con el texto ya desplazado, o hacia arriba, el scroll sigue.
 */
export function sheetGestureForMove(input: {
  dx: number;
  dy: number;
  scrollTop: number | null;
}): SheetGesturePhase {
  if (Math.abs(input.dx) < SHEET_DRAG_SLOP && Math.abs(input.dy) < SHEET_DRAG_SLOP) {
    return 'pending';
  }
  if (Math.abs(input.dx) > Math.abs(input.dy)) return 'scroll';
  if (input.dy < 0) return 'scroll';
  if (input.scrollTop === null || input.scrollTop <= 1) return 'drag';
  return 'scroll';
}

export function sheetGestureMove(
  state: SheetGestureState,
  point: { x: number; y: number },
): SheetGestureState {
  if (state.phase === 'scroll') return state;
  const dx = point.x - state.startX;
  const dy = point.y - state.startY;
  if (state.phase === 'pending') {
    const next = sheetGestureForMove({
      dx,
      dy,
      scrollTop: state.scrollTop,
    });
    if (next === 'pending') return state;
    if (next === 'scroll') return { ...state, phase: 'scroll', y: 0 };
    return { ...state, phase: 'drag', y: Math.max(0, dy) };
  }
  return { ...state, y: Math.max(0, dy) };
}

export function sheetDragDismisses(dragY: number, elapsedMs: number): boolean {
  if (dragY <= 0) return false;
  const elapsed = Math.max(1, elapsedMs);
  return dragY >= SHEET_DISMISS_DISTANCE || dragY / elapsed >= SHEET_DISMISS_VELOCITY;
}

export function sheetGestureEnd(
  state: SheetGestureState,
  time: number,
): { close: boolean; spring: boolean; blockClick: boolean } {
  if (state.phase !== 'drag') {
    return { close: false, spring: false, blockClick: false };
  }
  const close = sheetDragDismisses(state.y, time - state.startTime);
  return {
    close,
    spring: !close && state.y > 0,
    blockClick: close || state.y >= SHEET_DRAG_SLOP,
  };
}
