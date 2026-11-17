/**
 * Reader text-selection menu (4A).
 *
 * Chrome Android (and Android WebView) shows a native ActionMode toolbar
 * while a Selection is live. There is no reliable web API to hide that
 * toolbar without clearing the Selection. The robust approach: capture the
 * excerpt, clear the Selection (native menu goes away), keep the app popover
 * with that excerpt so Copy / Note / Highlight / Share still work.
 *
 * Desktop fine-pointer keeps the live Selection (blue highlight).
 */

export interface SelectionMenuEnv {
  userAgent: string;
  /** `matchMedia('(pointer: coarse)').matches` */
  pointerCoarse: boolean;
  /** `matchMedia('(hover: none)').matches` */
  hoverNone: boolean;
  /** Capacitor native shell (Android WebView ActionMode). */
  isNativePlatform: boolean;
}

/** True when showing the app menu should clear the native Selection. */
export function shouldClearNativeSelectionMenu(env: SelectionMenuEnv): boolean {
  if (env.isNativePlatform) return true;
  if (env.pointerCoarse || env.hoverNone) return true;
  const ua = env.userAgent || '';
  if (/Android/i.test(ua) && /Chrome\//i.test(ua)) return true;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return false;
}

export interface SelectionAnchor {
  top: number;
  left: number;
}

/** Same placement the lector used before this helper. */
export function selectionPopoverPosition(
  rect: { top: number; left: number; width: number },
  viewportWidth: number,
): SelectionAnchor {
  return {
    top: Math.max(64, rect.top - 10),
    left: Math.min(Math.max(rect.left + rect.width / 2, 92), viewportWidth - 92),
  };
}

export function clipSelectionExcerpt(text: string, max = 280): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 3)}…`;
}

/**
 * After we clear the native Selection to dismiss ActionMode, selectionchange
 * fires with a collapsed range. Keep the app popover in that case.
 */
export function keepSelectionPopoverOnCollapse(opts: {
  notaOpen: boolean;
  holdingClearedSelection: boolean;
  selectionCollapsed: boolean;
}): 'ignore' | 'dismiss' | 'evaluate' {
  if (opts.notaOpen) return 'ignore';
  if (opts.selectionCollapsed) {
    return opts.holdingClearedSelection ? 'ignore' : 'dismiss';
  }
  return 'evaluate';
}
