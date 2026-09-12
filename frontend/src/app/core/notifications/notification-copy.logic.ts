/**
 * Build the day's local-notification payloads from prefs + packed data.
 * Pure — no Capacitor.
 */

import {
  isLectioDivinaCombo,
  scheduledAt,
} from './notification-prefs.logic';
import type { DailyNotificationPrefs } from './notification-prefs.logic';
import { localDateIso } from '../lectio/lectio-day.logic';

export type DailyNotifKind = 'saint' | 'reading' | 'reflection' | 'lectio';

export interface PlannedDailyNotification {
  kind: DailyNotifKind;
  /** Stable numeric id for Capacitor (`kindBase + dayOffset`). */
  id: number;
  title: string;
  body: string;
  at: Date;
  path: string;
  dateIso: string;
}

export const DAILY_NOTIF_ID = {
  saint: 6100,
  lectio: 6200,
  reading: 6300,
  reflection: 6400,
} as const;

export const DAILY_NOTIF_HORIZON_DAYS = 14;

export interface DailyNotifDayInput {
  date: Date;
  saintName?: string | null;
  saintId?: string | null;
  gospelCite?: string | null;
  reflectionPreview?: string | null;
}

export interface DailyNotifPlanInput {
  now: Date;
  prefs: DailyNotificationPrefs;
  days: DailyNotifDayInput[];
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function notificationId(kind: DailyNotifKind, dayOffset: number): number {
  return DAILY_NOTIF_ID[kind] + dayOffset;
}

export function allScheduledNotificationIds(
  horizon = DAILY_NOTIF_HORIZON_DAYS,
): number[] {
  const ids: number[] = [];
  for (let i = 0; i < horizon; i++) {
    ids.push(notificationId('saint', i));
    ids.push(notificationId('lectio', i));
    ids.push(notificationId('reading', i));
    ids.push(notificationId('reflection', i));
  }
  return ids;
}

export function planDailyNotifications(
  input: DailyNotifPlanInput,
): PlannedDailyNotification[] {
  const { now, prefs, days } = input;
  if (!prefs.enabled) return [];
  const combo = isLectioDivinaCombo(prefs);
  const out: PlannedDailyNotification[] = [];

  days.forEach((day, i) => {
    const at = scheduledAt(day.date, prefs.time, now);
    if (!at) return;
    const dateIso = localDateIso(day.date);

    if (prefs.saint && day.saintName) {
      out.push({
        kind: 'saint',
        id: notificationId('saint', i),
        title: 'Santo del día',
        body: clip(day.saintName, 90),
        at,
        path: day.saintId ? `/santoral/${day.saintId}` : '/santoral',
        dateIso,
      });
    }

    if (combo) {
      const cite = day.gospelCite ? clip(day.gospelCite, 80) : '';
      out.push({
        kind: 'lectio',
        id: notificationId('lectio', i),
        title: 'Lectio divina',
        body: cite
          ? `Lectura y reflexión · ${cite}`
          : 'Lectura y reflexión del día',
        at,
        path: '/lectio',
        dateIso,
      });
      return;
    }

    if (prefs.reading) {
      const cite = day.gospelCite ? clip(day.gospelCite, 90) : '';
      out.push({
        kind: 'reading',
        id: notificationId('reading', i),
        title: 'Lectura del día',
        body: cite || 'Abrir las lecturas de hoy',
        at,
        path: '/lectio',
        dateIso,
      });
    }

    if (prefs.reflection) {
      out.push({
        kind: 'reflection',
        id: notificationId('reflection', i),
        title: 'Reflexión del día',
        body: day.reflectionPreview
          ? clip(day.reflectionPreview, 90)
          : 'Palabra del día · Lectio divina',
        at,
        path: '/lectio',
        dateIso,
      });
    }
  });

  return out;
}
