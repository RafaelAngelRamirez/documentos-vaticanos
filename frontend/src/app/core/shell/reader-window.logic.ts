/**
 * Sliding window for a long reader (Catechism and the same pattern).
 * Extending downward never pulls the forward edge back: that recenter
 * discarded the units just appended and the page jumped to earlier text.
 * The first unit still on screen stays mounted so the scroll anchor can
 * hold the viewport still while units above it are dropped.
 */

export interface RenderedRange {
  lo: number;
  hi: number;
}

/** Units kept in the DOM once the reader has moved past the opening. */
export const READER_MAX_RENDERED = 28;

/** Same lookahead the sentinel observer uses, in CSS pixels. */
export const READER_LOOKAHEAD_PX = 600;

/** How many automatic extends may follow one paint before the reader scrolls. */
export const READER_GROW_BURST = 8;

export type RouteFocus = 'load' | 'scroll' | 'keep';

/**
 * Highest `lo` that still keeps the first on-screen unit, plus one unit
 * of buffer just above the viewport.
 */
export function holdUnitForExtend(firstVisibleUnit: number): number {
  if (!Number.isFinite(firstVisibleUnit)) return 0;
  return Math.max(0, Math.floor(firstVisibleUnit) - 1);
}

/**
 * Pixels to add to scrollY so an anchor that moved in the viewport stays put.
 * Negative when units above the anchor were removed.
 */
export function scrollDeltaToHoldAnchor(topBefore: number, topAfter: number): number {
  if (!Number.isFinite(topBefore) || !Number.isFinite(topAfter)) return 0;
  return topAfter - topBefore;
}

/**
 * A scroll-spy `replaceUrl` comes back through the route. That echo must
 * not scroll or re-pin: the unit is already the one on screen.
 * A different unit (index, citation, back) still scrolls.
 * Another document loads.
 */
export function routeFocusAction(input: {
  sameDocument: boolean;
  routeUnit: number;
  reportedUnit: number | null;
  rendered: boolean;
}): RouteFocus {
  if (!input.sameDocument) return 'load';
  if (
    input.reportedUnit != null &&
    input.routeUnit === input.reportedUnit &&
    input.rendered
  ) {
    return 'keep';
  }
  return 'scroll';
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const floored = Math.floor(value);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored;
}

/**
 * Grow the rendered range by `step` units.
 * `holdUnit` is the highest `lo` allowed while moving down (and the last
 * unit that must remain while moving up). The forward edge only increases
 * when moving down; the back edge only decreases when moving up.
 */
export function extendRenderedRange(
  range: RenderedRange,
  total: number,
  step: number,
  direction: 'down' | 'up',
  maxRendered = READER_MAX_RENDERED,
  holdUnit = 0,
): RenderedRange {
  const len = Math.max(0, Math.floor(total));
  const span = Math.max(1, Math.floor(maxRendered));
  const count = Math.max(1, Math.floor(step));
  const lo0 = clampInt(range.lo, 0, len);
  const hi0 = clampInt(range.hi, lo0, len);
  const hold = clampInt(holdUnit, 0, Math.max(0, len - 1));

  if (direction === 'down') {
    if (hi0 >= len) return { lo: lo0, hi: hi0 };
    const hi = Math.min(len, hi0 + count);
    let lo = lo0;
    if (hi - lo > span) {
      const trimTo = hi - span;
      lo = Math.max(lo0, Math.min(trimTo, hold));
    }
    return { lo, hi };
  }

  if (lo0 <= 0) return { lo: lo0, hi: hi0 };
  const lo = Math.max(0, lo0 - count);
  let hi = hi0;
  if (hi - lo > span) {
    const trimTo = lo + span;
    hi = Math.min(hi0, Math.max(trimTo, hold + 1));
  }
  return { lo, hi };
}
