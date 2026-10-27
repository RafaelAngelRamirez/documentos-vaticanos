/**
 * Whether the reader bars stay up while the page scrolls.
 * Pure. The component owns the timer that marks a route jump.
 */

export interface BarScroll {
  lastScrollY: number;
  scrollAccum: number;
  barsHidden: boolean;
}

export interface BarScrollInput {
  y: number;
  atTop: boolean;
  atBottom: boolean;
  uiOpen: boolean;
  /** A route jump is scrolling. That jump is not the reader moving down. */
  jumpGuardsBars: boolean;
}

/** Same threshold the reader already used before this helper. */
export const BAR_HIDE_AFTER_PX = 24;

export function barsAfterScroll(prev: BarScroll, input: BarScrollInput): BarScroll {
  if (input.jumpGuardsBars) {
    return { lastScrollY: input.y, scrollAccum: 0, barsHidden: false };
  }
  const delta = input.y - prev.lastScrollY;
  if (input.atTop || input.atBottom || input.uiOpen) {
    return { lastScrollY: input.y, scrollAccum: 0, barsHidden: false };
  }
  const scrollAccum =
    Math.sign(delta) === Math.sign(prev.scrollAccum)
      ? prev.scrollAccum + delta
      : delta;
  let barsHidden = prev.barsHidden;
  if (scrollAccum > BAR_HIDE_AFTER_PX) barsHidden = true;
  else if (scrollAccum < -BAR_HIDE_AFTER_PX) barsHidden = false;
  return { lastScrollY: input.y, scrollAccum, barsHidden };
}
