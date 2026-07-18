/**
 * Pure santoral calendar index (no Angular).
 * Groups saints by feastDays keys as MM-DD (general Roman calendar, no year).
 */

export interface CalendarSaint {
  id: string;
  name: string;
  displayName?: string;
  feastDays?: string[];
  meta?: string;
  role?: string;
  years?: string;
  bio?: string;
  eraLabel?: string;
}

export interface MonthSummary {
  /** 1–12 */
  month: number;
  /** Zero-padded MM */
  mm: string;
  label: string;
  /** Distinct days in this month that have ≥1 saint */
  daysWithSaints: number;
  /** Total saint rows (a saint on two days in same month counts twice) */
  saintEntries: number;
}

export interface DayCell {
  /** 1–31 */
  day: number;
  /** MM-DD */
  feastKey: string;
  saintCount: number;
  saints: CalendarSaint[];
}

export const MONTH_LABELS_ES: readonly string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Days in month for a non-leap reference year (general calendar grid). */
export function daysInMonth(month: number): number {
  if (month < 1 || month > 12) return 0;
  // 2001 is not a leap year — Feb has 28
  return new Date(2001, month, 0).getDate();
}

/**
 * Normalize a feast key to MM-DD or null if invalid.
 * Accepts "07-18", "7-18", "07/18".
 */
export function normalizeFeastDay(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  if (dd > daysInMonth(mm)) return null;
  return `${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function feastKey(month: number, day: number): string | null {
  return normalizeFeastDay(
    `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
}

/** All normalized feast keys for a saint (may be empty). */
export function saintFeastKeys(saint: CalendarSaint): string[] {
  const out: string[] = [];
  for (const f of saint.feastDays || []) {
    const k = normalizeFeastDay(f);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/**
 * Saints whose feastDays include the given MM-DD.
 * Saints without feastDays never appear.
 */
export function saintsForDay(
  saints: CalendarSaint[],
  monthOrKey: number | string,
  day?: number,
): CalendarSaint[] {
  let key: string | null;
  if (typeof monthOrKey === 'string') {
    key = normalizeFeastDay(monthOrKey);
  } else {
    key = feastKey(monthOrKey, day ?? 0);
  }
  if (!key) return [];
  const list = (saints || []).filter((s) => saintFeastKeys(s).includes(key!));
  return list.slice().sort((a, b) =>
    (a.displayName || a.name).localeCompare(b.displayName || b.name, 'es'),
  );
}

/**
 * Day cells for a month (1..daysInMonth), including empty days.
 */
export function monthDayCells(
  saints: CalendarSaint[],
  month: number,
): DayCell[] {
  const n = daysInMonth(month);
  const cells: DayCell[] = [];
  for (let d = 1; d <= n; d++) {
    const key = feastKey(month, d)!;
    const daySaints = saintsForDay(saints, key);
    cells.push({
      day: d,
      feastKey: key,
      saintCount: daySaints.length,
      saints: daySaints,
    });
  }
  return cells;
}

/**
 * Year overview: 12 months with counts (general calendar, no multi-year).
 */
export function yearMonthSummaries(saints: CalendarSaint[]): MonthSummary[] {
  const list = saints || [];
  return MONTH_LABELS_ES.map((label, i) => {
    const month = i + 1;
    const mm = String(month).padStart(2, '0');
    const cells = monthDayCells(list, month);
    const daysWithSaints = cells.filter((c) => c.saintCount > 0).length;
    const saintEntries = cells.reduce((acc, c) => acc + c.saintCount, 0);
    return { month, mm, label, daysWithSaints, saintEntries };
  });
}

export function monthLabel(month: number): string {
  if (month < 1 || month > 12) return '';
  return MONTH_LABELS_ES[month - 1];
}

/** Parse month route/query param "07" | "7" → 1–12 or null. */
export function parseMonthParam(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return Math.trunc(n);
}

/** Parse day param → 1–31 or null (not validated against month length). */
export function parseDayParam(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 31) return null;
  return Math.trunc(n);
}

/** Display label for a calendar saint row. */
export function calendarSaintLabel(s: CalendarSaint): string {
  return s.displayName || s.name || s.id;
}

/**
 * Local calendar feast key for a Date (device timezone), as MM-DD.
 * Injectable `now` for deterministic tests.
 */
export function localFeastKey(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

/**
 * Spanish human label for a local date, e.g. "18 de julio".
 */
export function localFeastLabelEs(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const label = monthLabel(month) || '';
  return `${day} de ${label.toLowerCase()}`;
}

/**
 * Saints of the day for a local Date (or explicit MM-DD).
 * Does not invent saints; empty feastDays never match.
 */
export function saintsOfDay(
  saints: CalendarSaint[],
  nowOrKey: Date | string = new Date(),
): CalendarSaint[] {
  const key =
    typeof nowOrKey === 'string' ? normalizeFeastDay(nowOrKey) : localFeastKey(nowOrKey);
  if (!key) return [];
  return saintsForDay(saints, key);
}

const DEFAULT_INTRO_MAX = 160;

/**
 * Brief introduction from pack fields only (bio truncated, else role/meta/eraLabel).
 * Never fabricates hagiography when bio is missing.
 */
export function briefSaintIntro(
  saint: CalendarSaint | null | undefined,
  maxLen: number = DEFAULT_INTRO_MAX,
): string {
  if (!saint) return '';
  const bio = collapseIntroWs(saint.bio || '');
  if (bio.length > 0) {
    return truncateIntro(bio, maxLen);
  }
  const fallback = [saint.role, saint.meta, saint.eraLabel, saint.years]
    .map((x) => collapseIntroWs(x || ''))
    .filter(Boolean);
  if (fallback.length) {
    return truncateIntro(fallback.join(' · '), maxLen);
  }
  return '';
}

function collapseIntroWs(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateIntro(text: string, maxLen: number): string {
  if (maxLen < 1 || text.length <= maxLen) return text;
  // Prefer cut at word boundary when possible
  const slice = text.slice(0, maxLen);
  const sp = slice.lastIndexOf(' ');
  const base = sp > Math.floor(maxLen * 0.6) ? slice.slice(0, sp) : slice;
  return base.replace(/[.,;:\s]+$/g, '') + '…';
}
