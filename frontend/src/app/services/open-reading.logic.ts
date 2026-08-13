/**
 * Pure helpers for opening the immersive reader from cover / CTA surfaces.
 * NavigationService.openReading / navigateToUnit own the Angular side.
 */

/** sessionStorage flag read by LectorComponent on load (auto-start narrator). */
export const AUTO_NARR_KEY = 'dv.autoNarr';

export interface OpenReadingOptions {
  /** Unit index in content.json (default 0). */
  unitIndex?: number;
  /** When true, set AUTO_NARR_KEY so the lector starts the narrator. */
  autoNarr?: boolean;
}

/**
 * Normalize a requested unit index for openReading / navigateToUnit.
 * @returns floor(index) or null if invalid.
 */
export function resolveOpenReadingIndex(unitIndex?: number): number | null {
  const raw = unitIndex == null ? 0 : unitIndex;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return null;
  }
  return Math.floor(raw);
}

/**
 * Persist the auto-narrator handoff flag (safe no-op if storage throws).
 * Injectable storage for tests; defaults to sessionStorage in browser.
 */
export function applyAutoNarrFlag(
  autoNarr: boolean | undefined,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!autoNarr) return;
  const store =
    storage === undefined
      ? typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null
      : storage;
  if (!store) return;
  try {
    store.setItem(AUTO_NARR_KEY, '1');
  } catch {
    // private mode / quota — lector simply won't auto-start
  }
}

/**
 * Unit index for cover / home / ficha CTAs: continue only when progress
 * exists for this pack; otherwise start at 0.
 */
export function resolveCoverReadingIndex(
  canContinue: boolean,
  lastUnitIndex?: number | null,
): number {
  if (
    canContinue &&
    typeof lastUnitIndex === 'number' &&
    Number.isFinite(lastUnitIndex) &&
    lastUnitIndex > 0
  ) {
    return Math.floor(lastUnitIndex);
  }
  return 0;
}
