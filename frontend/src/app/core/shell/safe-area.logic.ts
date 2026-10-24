/**
 * Safe-area inset helpers for edge-to-edge shells (Android WebView / iOS).
 * Pure: no Angular DI, no Capacitor — unit-testable with node strip-types.
 *
 * Android WebView often reports CSS env(safe-area-inset-*) as 0 under
 * targetSdk 35 edge-to-edge; MainActivity publishes real window insets into
 * the same CSS variables and window.__DV_SAFE_AREA__.
 */

/** CSS custom properties consumed by styles.css and fixed chrome. */
export const SAFE_AREA_CSS_VARS = {
  top: '--safe-area-inset-top',
  right: '--safe-area-inset-right',
  bottom: '--safe-area-inset-bottom',
  left: '--safe-area-inset-left',
} as const;

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Minimal style surface (documentElement or a test double). */
export interface StyleRoot {
  style: {
    setProperty(name: string, value: string): void;
  };
}

/** Coerce to a non-negative integer CSS-pixel inset. */
export function normalizeInsetPx(value: number | null | undefined): number {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  return Math.round(value);
}

/** Format as CSS length (e.g. "48px"). */
export function insetToCssPx(value: number | null | undefined): string {
  return `${normalizeInsetPx(value)}px`;
}

/**
 * Prefer the larger of CSS env() and native bridge.
 * Android often has env=0 while the bridge reports the nav-bar height.
 */
export function resolveInset(
  envPx: number | null | undefined,
  bridgePx: number | null | undefined
): number {
  return Math.max(normalizeInsetPx(envPx), normalizeInsetPx(bridgePx));
}

/** Resolve all four sides independently. */
export function resolveInsets(
  env: Partial<SafeAreaInsets> | null | undefined,
  bridge: Partial<SafeAreaInsets> | null | undefined
): SafeAreaInsets {
  const e = env || {};
  const b = bridge || {};
  return {
    top: resolveInset(e.top, b.top),
    right: resolveInset(e.right, b.right),
    bottom: resolveInset(e.bottom, b.bottom),
    left: resolveInset(e.left, b.left),
  };
}

/**
 * Write inset CSS variables on a root element.
 * Only sets sides present on `insets` (partial apply is allowed).
 */
export function applySafeAreaInsets(
  root: StyleRoot,
  insets: Partial<SafeAreaInsets>
): void {
  if (insets.top != null) {
    root.style.setProperty(SAFE_AREA_CSS_VARS.top, insetToCssPx(insets.top));
  }
  if (insets.right != null) {
    root.style.setProperty(SAFE_AREA_CSS_VARS.right, insetToCssPx(insets.right));
  }
  if (insets.bottom != null) {
    root.style.setProperty(
      SAFE_AREA_CSS_VARS.bottom,
      insetToCssPx(insets.bottom)
    );
  }
  if (insets.left != null) {
    root.style.setProperty(SAFE_AREA_CSS_VARS.left, insetToCssPx(insets.left));
  }
}

/**
 * Content clearance under fixed app bnav: bar height + system bottom inset.
 * Mirrors `.has-bnav { padding-bottom: calc(var(--bnav-height) + …) }`.
 */
export function hasBnavPaddingPx(
  bnavHeightPx: number,
  bottomInsetPx: number
): number {
  return normalizeInsetPx(bnavHeightPx) + normalizeInsetPx(bottomInsetPx);
}

/**
 * JS snippet for Android WebView.evaluateJavascript — must stay in sync with
 * MainActivity.publishSafeArea and applySafeAreaInsets variable names.
 */
export function buildApplyInsetsJs(insets: SafeAreaInsets): string {
  const top = normalizeInsetPx(insets.top);
  const right = normalizeInsetPx(insets.right);
  const bottom = normalizeInsetPx(insets.bottom);
  const left = normalizeInsetPx(insets.left);
  return (
    `(function(){var r=document.documentElement;` +
    `r.style.setProperty('${SAFE_AREA_CSS_VARS.top}','${top}px');` +
    `r.style.setProperty('${SAFE_AREA_CSS_VARS.right}','${right}px');` +
    `r.style.setProperty('${SAFE_AREA_CSS_VARS.bottom}','${bottom}px');` +
    `r.style.setProperty('${SAFE_AREA_CSS_VARS.left}','${left}px');` +
    `window.__DV_SAFE_AREA__={top:${top},right:${right},bottom:${bottom},left:${left}};` +
    `try{window.dispatchEvent(new CustomEvent('dv-safe-area',{detail:window.__DV_SAFE_AREA__}));}catch(e){}})();`
  );
}

/** Read bridge payload from window if MainActivity already published it. */
export function readBridgeSafeArea(
  win: { __DV_SAFE_AREA__?: Partial<SafeAreaInsets> } | null | undefined
): SafeAreaInsets | null {
  if (!win || !win.__DV_SAFE_AREA__) {
    return null;
  }
  const raw = win.__DV_SAFE_AREA__;
  return {
    top: normalizeInsetPx(raw.top),
    right: normalizeInsetPx(raw.right),
    bottom: normalizeInsetPx(raw.bottom),
    left: normalizeInsetPx(raw.left),
  };
}
