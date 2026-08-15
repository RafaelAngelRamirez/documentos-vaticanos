/**
 * Safe-area inset helpers for edge-to-edge shells (Android WebView / iOS / PWA).
 * Pure: no Angular DI, no Capacitor — unit-testable.
 *
 * Android WebView often reports CSS env(safe-area-inset-*) as 0 under
 * targetSdk 35 edge-to-edge. A native bridge may publish real window insets
 * into --safe-area-bridge-* and window.__DV_SAFE_AREA__.
 */

export const SAFE_AREA_CSS_VARS = {
  top: '--safe-area-inset-top',
  right: '--safe-area-inset-right',
  bottom: '--safe-area-inset-bottom',
  left: '--safe-area-inset-left',
} as const;

export const SAFE_AREA_BRIDGE_VARS = {
  top: '--safe-area-bridge-top',
  right: '--safe-area-bridge-right',
  bottom: '--safe-area-bridge-bottom',
  left: '--safe-area-bridge-left',
} as const;

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface StyleRoot {
  style: {
    setProperty(name: string, value: string): void;
  };
}

export function normalizeInsetPx(value: number | null | undefined): number {
  if (value == null || typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  return Math.round(value);
}

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

/** True when the payload is an uninitialized all-zero publish (onStart race). */
export function isUninitializedZeroBridge(
  insets: Partial<SafeAreaInsets> | null | undefined
): boolean {
  if (!insets) return true;
  return (
    normalizeInsetPx(insets.top) === 0 &&
    normalizeInsetPx(insets.right) === 0 &&
    normalizeInsetPx(insets.bottom) === 0 &&
    normalizeInsetPx(insets.left) === 0
  );
}

export function applySafeAreaInsets(
  root: StyleRoot,
  insets: Partial<SafeAreaInsets>
): void {
  if (insets.top != null) {
    root.style.setProperty(SAFE_AREA_BRIDGE_VARS.top, insetToCssPx(insets.top));
  }
  if (insets.right != null) {
    root.style.setProperty(
      SAFE_AREA_BRIDGE_VARS.right,
      insetToCssPx(insets.right)
    );
  }
  if (insets.bottom != null) {
    root.style.setProperty(
      SAFE_AREA_BRIDGE_VARS.bottom,
      insetToCssPx(insets.bottom)
    );
  }
  if (insets.left != null) {
    root.style.setProperty(
      SAFE_AREA_BRIDGE_VARS.left,
      insetToCssPx(insets.left)
    );
  }
}

export function hasBnavPaddingPx(
  bnavHeightPx: number,
  bottomInsetPx: number
): number {
  return normalizeInsetPx(bnavHeightPx) + normalizeInsetPx(bottomInsetPx);
}

/** JS snippet for Android WebView.evaluateJavascript. */
export function buildApplyInsetsJs(insets: SafeAreaInsets): string {
  const top = normalizeInsetPx(insets.top);
  const right = normalizeInsetPx(insets.right);
  const bottom = normalizeInsetPx(insets.bottom);
  const left = normalizeInsetPx(insets.left);
  return (
    `(function(){var r=document.documentElement;` +
    `r.style.setProperty('${SAFE_AREA_BRIDGE_VARS.top}','${top}px');` +
    `r.style.setProperty('${SAFE_AREA_BRIDGE_VARS.right}','${right}px');` +
    `r.style.setProperty('${SAFE_AREA_BRIDGE_VARS.bottom}','${bottom}px');` +
    `r.style.setProperty('${SAFE_AREA_BRIDGE_VARS.left}','${left}px');` +
    `window.__DV_SAFE_AREA__={top:${top},right:${right},bottom:${bottom},left:${left}};` +
    `try{window.dispatchEvent(new CustomEvent('dv-safe-area',{detail:window.__DV_SAFE_AREA__}));}catch(e){}})();`
  );
}

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

/** Fallback when both env and bridge are 0: visualViewport vs innerHeight. */
export function estimateBottomFromVisualViewport(
  innerHeight: number,
  visualHeight: number | null | undefined
): number {
  if (visualHeight == null || !Number.isFinite(visualHeight)) return 0;
  const delta = normalizeInsetPx(innerHeight) - normalizeInsetPx(visualHeight);
  if (delta < 8) return 0;
  return Math.min(delta, 96);
}

export function readEnvInsetsFromComputed(
  getProp: (name: string) => string
): SafeAreaInsets {
  const parse = (name: string) => {
    const raw = (getProp(name) || '').trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: parse('--safe-area-env-top'),
    right: parse('--safe-area-env-right'),
    bottom: parse('--safe-area-env-bottom'),
    left: parse('--safe-area-env-left'),
  };
}
