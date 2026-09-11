/**
 * Reader chrome geometry (mobile/Android stacking).
 * Pure: no Angular / DOM — unit-testable with node strip-types.
 * Self-contained (no relative TS imports) so Node strip-types can load it.
 *
 * CSS custom properties in styles.css / lector.component.css must match
 * READER_CHROME pixel constants.
 *
 * Mobile (<1024px): .rfoot sits on the physical bottom (includes system
 * inset in its box); .narr sits in the band immediately above .rfoot.
 * They must never share a vertical range. Reading text padding-bottom
 * reserves the stacked height + breathing room.
 */

/** Same contract as safe-area.logic normalizeInsetPx (kept local for Node load). */
function chromeInsetPx(value: number | null | undefined): number {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  return Math.round(value);
}

/** Canonical band sizes in CSS pixels (content + padding, excluding inset). */
export const READER_CHROME = {
  /** Matches `.only-mobile` / wbar breakpoint (width ≤ this is mobile). */
  mobileMaxWidthPx: 1023,
  /**
   * Top bar box excluding status-bar inset: 48px tap row + 12+12 padding.
   * Total painted height = topBarHeightPx + topInset.
   */
  topBarHeightPx: 72,
  topBarTapPx: 48,
  topBarPadYPx: 12,
  /** Position bar (.rfoot) excluding system bottom inset. */
  rfootHeightPx: 44,
  /** Narrator bar (.narr): 12+48 play+12. */
  narrHeightPx: 72,
  /** Extra space so the last unit is not flush against chrome. */
  contentBreathingPx: 16,
} as const;

/** CSS custom property names consumed by the reader layout. */
export const READER_CHROME_CSS_VARS = {
  rfootHeight: '--reader-rfoot-height',
  narrHeight: '--reader-narr-height',
  topBarHeight: '--reader-topbar-height',
  breathing: '--reader-chrome-breathing',
} as const;

export function isMobileReaderWidth(viewportWidthPx: number): boolean {
  if (!Number.isFinite(viewportWidthPx)) return true;
  return viewportWidthPx <= READER_CHROME.mobileMaxWidthPx;
}

/** Vertical band measured from the bottom of the viewport, half-open [from, to). */
export interface VerticalBand {
  id: 'rfoot' | 'narr' | 'topbar';
  fromBottomPx: number;
  toBottomPx: number;
}

export interface ReaderBottomChromeInput {
  viewportWidthPx: number;
  bottomInsetPx: number;
  narrVisible: boolean;
  /** Defaults to mobile (rfoot is `.only-mobile`). */
  rfootVisible?: boolean;
}

export function bandsOverlap(a: VerticalBand, b: VerticalBand): boolean {
  return a.fromBottomPx < b.toBottomPx && b.fromBottomPx < a.toBottomPx;
}

/**
 * Bottom chrome bands from the viewport bottom.
 * Mobile + both visible: rfoot [0, rfoot+inset), narr [rfoot+inset, …).
 * Desktop: rfoot omitted; narr [0, narr+inset).
 */
export function readerBottomBands(
  input: ReaderBottomChromeInput
): VerticalBand[] {
  const mobile = isMobileReaderWidth(input.viewportWidthPx);
  const inset = chromeInsetPx(input.bottomInsetPx);
  const rfootVisible = input.rfootVisible ?? mobile;
  const bands: VerticalBand[] = [];

  if (rfootVisible) {
    bands.push({
      id: 'rfoot',
      fromBottomPx: 0,
      toBottomPx: READER_CHROME.rfootHeightPx + inset,
    });
  }

  if (input.narrVisible) {
    const from = rfootVisible ? READER_CHROME.rfootHeightPx + inset : 0;
    const extraInset = rfootVisible ? 0 : inset;
    bands.push({
      id: 'narr',
      fromBottomPx: from,
      toBottomPx: from + READER_CHROME.narrHeightPx + extraInset,
    });
  }

  return bands;
}

/** Distance from the top of the stacked bottom chrome to the viewport bottom. */
export function readerBottomStackHeightPx(
  input: ReaderBottomChromeInput
): number {
  const bands = readerBottomBands(input);
  return bands.reduce((max, b) => Math.max(max, b.toBottomPx), 0);
}

/**
 * padding-bottom for `.reader` so text is not hidden under chrome.
 * Always at least inset + breathing (gesture bar) even with no bars.
 */
export function readerContentBottomPadPx(
  input: ReaderBottomChromeInput
): number {
  const stack = readerBottomStackHeightPx(input);
  const inset = chromeInsetPx(input.bottomInsetPx);
  const base = stack > 0 ? stack : inset;
  return base + READER_CHROME.contentBreathingPx;
}

/** Sticky top bar clearance (painted height including status-bar inset). */
export function readerTopClearancePx(topInsetPx: number): number {
  return READER_CHROME.topBarHeightPx + chromeInsetPx(topInsetPx);
}

/**
 * Offset from the viewport bottom for a toast/popover that must sit
 * above the stacked reader chrome (e.g. `.selfeedback`).
 */
export function readerFeedbackBottomPx(
  input: ReaderBottomChromeInput,
  gapPx: number = 12
): number {
  return readerBottomStackHeightPx(input) + chromeInsetPx(gapPx);
}

/** CSS length map matching READER_CHROME (for tests / apply). */
export function readerChromeCssPx(): Record<
  (typeof READER_CHROME_CSS_VARS)[keyof typeof READER_CHROME_CSS_VARS],
  string
> {
  return {
    [READER_CHROME_CSS_VARS.rfootHeight]: `${READER_CHROME.rfootHeightPx}px`,
    [READER_CHROME_CSS_VARS.narrHeight]: `${READER_CHROME.narrHeightPx}px`,
    [READER_CHROME_CSS_VARS.topBarHeight]: `${READER_CHROME.topBarHeightPx}px`,
    [READER_CHROME_CSS_VARS.breathing]: `${READER_CHROME.contentBreathingPx}px`,
  };
}
