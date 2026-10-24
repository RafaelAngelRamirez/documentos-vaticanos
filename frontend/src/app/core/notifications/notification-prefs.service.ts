import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DailyNotificationPrefs,
  DEFAULT_DAILY_NOTIFICATION_PREFS,
  NOTIF_PREFS_STORAGE_KEY,
  hasAnyDailyChannel,
  isLectioDivinaCombo,
  normalizeNotifTime,
  parseDailyNotificationPrefs,
  serializeDailyNotificationPrefs,
} from './notification-prefs.logic';

export type { DailyNotificationPrefs } from './notification-prefs.logic';
export {
  NOTIF_PREFS_STORAGE_KEY,
  DEFAULT_DAILY_NOTIFICATION_PREFS,
  hasAnyDailyChannel,
  isLectioDivinaCombo,
  normalizeNotifTime,
};

@Injectable({ providedIn: 'root' })
export class NotificationPrefsService {
  private readonly subject = new BehaviorSubject<DailyNotificationPrefs>(
    this.load(),
  );

  readonly prefs$ = this.subject.asObservable();

  get snapshot(): DailyNotificationPrefs {
    return this.subject.value;
  }

  update(partial: Partial<DailyNotificationPrefs>): DailyNotificationPrefs {
    const next: DailyNotificationPrefs = {
      ...this.subject.value,
      ...partial,
    };
    if (partial.time !== undefined) {
      next.time = normalizeNotifTime(partial.time);
    }
    this.subject.next(next);
    this.persist(next);
    return next;
  }

  private load(): DailyNotificationPrefs {
    try {
      return parseDailyNotificationPrefs(
        localStorage.getItem(NOTIF_PREFS_STORAGE_KEY),
      );
    } catch {
      return { ...DEFAULT_DAILY_NOTIFICATION_PREFS };
    }
  }

  private persist(prefs: DailyNotificationPrefs): void {
    try {
      localStorage.setItem(
        NOTIF_PREFS_STORAGE_KEY,
        serializeDailyNotificationPrefs(prefs),
      );
    } catch {
      /* ignore */
    }
  }
}
