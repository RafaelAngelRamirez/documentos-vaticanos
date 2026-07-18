/**
 * Pure last-read helpers (no Angular). Used by ReadingProgressService and tests.
 * Keys aligned with design ARQUITECTURA.md (`dv.*`).
 */

export const LAST_READ_KEY = 'dv.lastRead';
export const NAV_KEY = 'dv.nav';
export const SETTINGS_KEY = 'dv.settings';

export interface LastRead {
  documentId: string;
  title: string;
  unitIndex: number;
  unitCount: number;
  label?: string;
  updatedAt: string;
}

export type LastReadInput = Omit<LastRead, 'updatedAt'>;

/** Parse stored last-read JSON (null if missing/invalid). */
export function parseLastRead(raw: string | null | undefined): LastRead | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastRead;
    if (!parsed || typeof parsed.documentId !== 'string') return null;
    if (typeof parsed.unitIndex !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Build full last-read entry with updatedAt (ISO). */
export function buildLastRead(
  entry: LastReadInput,
  now: () => string = () => new Date().toISOString(),
): LastRead {
  return { ...entry, updatedAt: now() };
}

export function serializeLastRead(entry: LastRead): string {
  return JSON.stringify(entry);
}

/**
 * Storage-agnostic set/get for last read (drives the real offline key).
 * `store` is localStorage-compatible.
 */
export function setLastReadInStore(
  store: { setItem(key: string, value: string): void },
  entry: LastReadInput,
  now?: () => string,
): LastRead {
  const full = buildLastRead(entry, now);
  store.setItem(LAST_READ_KEY, serializeLastRead(full));
  try {
    store.setItem(
      NAV_KEY,
      JSON.stringify({ view: 'lector', docId: entry.documentId }),
    );
  } catch {
    /* ignore nav side-effect failures */
  }
  return full;
}

export function getLastReadFromStore(store: {
  getItem(key: string): string | null;
}): LastRead | null {
  return parseLastRead(store.getItem(LAST_READ_KEY));
}

/** 0–100 progress estimate from unit index. */
export function lastReadPercent(
  entry: LastRead | null | undefined,
): number {
  if (!entry?.unitCount || entry.unitCount <= 0) return 0;
  const p = Math.round((entry.unitIndex / entry.unitCount) * 100);
  return Math.min(100, Math.max(0, p));
}
