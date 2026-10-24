/**
 * Daily notification preferences (localStorage). Pure — no Angular.
 */

export const NOTIF_PREFS_STORAGE_KEY = 'dv.notif.prefs.v1';

export interface DailyNotificationPrefs {
  /** Master switch. Channels are ignored when false. */
  enabled: boolean;
  /** Local 24h time `HH:MM`. */
  time: string;
  saint: boolean;
  reading: boolean;
  reflection: boolean;
}

export const DEFAULT_DAILY_NOTIFICATION_PREFS: DailyNotificationPrefs = {
  enabled: false,
  time: '07:00',
  saint: false,
  reading: false,
  reflection: false,
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeNotifTime(raw: string | null | undefined): string {
  const s = String(raw || '').trim();
  if (TIME_RE.test(s)) return s;
  const loose = s.match(/^(\d{1,2}):(\d{2})$/);
  if (loose) {
    const h = Number(loose[1]);
    const m = Number(loose[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return DEFAULT_DAILY_NOTIFICATION_PREFS.time;
}

export function parseNotifTime(
  raw: string | null | undefined,
): { hour: number; minute: number } {
  const t = normalizeNotifTime(raw);
  const [h, m] = t.split(':').map((n) => Number(n));
  return { hour: h, minute: m };
}

export function parseDailyNotificationPrefs(
  raw: string | null | undefined,
): DailyNotificationPrefs {
  const base: DailyNotificationPrefs = {
    ...DEFAULT_DAILY_NOTIFICATION_PREFS,
  };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyNotificationPrefs>;
    if (typeof parsed.enabled === 'boolean') base.enabled = parsed.enabled;
    if (typeof parsed.time === 'string') base.time = normalizeNotifTime(parsed.time);
    if (typeof parsed.saint === 'boolean') base.saint = parsed.saint;
    if (typeof parsed.reading === 'boolean') base.reading = parsed.reading;
    if (typeof parsed.reflection === 'boolean') base.reflection = parsed.reflection;
  } catch {
    /* keep defaults */
  }
  return base;
}

export function serializeDailyNotificationPrefs(
  prefs: DailyNotificationPrefs,
): string {
  return JSON.stringify({
    enabled: Boolean(prefs.enabled),
    time: normalizeNotifTime(prefs.time),
    saint: Boolean(prefs.saint),
    reading: Boolean(prefs.reading),
    reflection: Boolean(prefs.reflection),
  });
}

/** Lectura + reflexión together = Lectio Divina (one combined notification). */
export function isLectioDivinaCombo(
  prefs: Pick<DailyNotificationPrefs, 'enabled' | 'reading' | 'reflection'>,
): boolean {
  return Boolean(prefs.enabled && prefs.reading && prefs.reflection);
}

export function hasAnyDailyChannel(
  prefs: Pick<
    DailyNotificationPrefs,
    'enabled' | 'saint' | 'reading' | 'reflection'
  >,
): boolean {
  if (!prefs.enabled) return false;
  return Boolean(prefs.saint || prefs.reading || prefs.reflection);
}

/**
 * Local fire instant for `day`'s calendar date at `time`.
 * Returns null when that instant is already in the past.
 */
export function scheduledAt(
  day: Date,
  time: string,
  now: Date,
): Date | null {
  const { hour, minute } = parseNotifTime(time);
  const d = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
    0,
    0,
  );
  if (d.getTime() <= now.getTime()) return null;
  return d;
}
