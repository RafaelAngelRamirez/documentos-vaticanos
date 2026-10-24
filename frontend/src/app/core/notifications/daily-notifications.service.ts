import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Subscription } from 'rxjs';
import { calendarSaintLabel, saintsOfDay } from '../santoral/santoral-calendar.logic';
import { SaintRecord } from '../santoral/santoral-resolve.logic';
import { SantoralService } from '../santoral/santoral.service';
import { liturgicalDateOf } from '../liturgia/liturgical-date.logic';
import { lecturasForLiturgicalDate } from '../liturgia/lecturas-del-dia.logic';
import { snippet } from '../lectio/lectio-day.logic';
import { PalabraDelDiaService } from '../lectio/palabra-del-dia.service';
import {
  DAILY_NOTIF_HORIZON_DAYS,
  DailyNotifDayInput,
  allScheduledNotificationIds,
  planDailyNotifications,
} from './notification-copy.logic';
import {
  DailyNotificationPrefs,
  NotificationPrefsService,
  hasAnyDailyChannel,
} from './notification-prefs.service';

const CHANNEL_ID = 'daily-devotion';

/**
 * Local daily reminders (saint / reading / reflection / lectio).
 * Android is the real target. Web: best-effort while the page is alive.
 */
@Injectable({ providedIn: 'root' })
export class DailyNotificationsService {
  private sub = new Subscription();
  private listenerAttached = false;
  private started = false;
  private saints: SaintRecord[] = [];

  constructor(
    private readonly prefs: NotificationPrefsService,
    private readonly santoral: SantoralService,
    private readonly palabra: PalabraDelDiaService,
    private readonly router: Router,
  ) {}

  init(): void {
    if (this.started) return;
    this.started = true;
    this.attachTapListener();
    this.sub.add(
      this.prefs.prefs$.subscribe((p) => {
        void this.resync(p);
      }),
    );
    this.sub.add(
      this.santoral.loadManifest().subscribe({
        next: (m) => {
          this.saints = (m.saints || []) as SaintRecord[];
          void this.resync(this.prefs.snapshot);
        },
        error: () => {
          this.saints = [];
        },
      }),
    );
  }

  async requestPermission(): Promise<boolean> {
    if (!this.pluginAvailable()) return false;
    try {
      const cur = await LocalNotifications.checkPermissions();
      if (cur.display === 'granted') return true;
      const next = await LocalNotifications.requestPermissions();
      return next.display === 'granted';
    } catch {
      return false;
    }
  }

  async resync(prefs: DailyNotificationPrefs = this.prefs.snapshot): Promise<void> {
    if (!this.pluginAvailable()) return;
    await this.cancelPlanned();
    if (!hasAnyDailyChannel(prefs)) return;
    const granted = await this.requestPermission();
    if (!granted) return;
    await this.ensureChannel();
    const days = this.buildDays(prefs);
    const planned = planDailyNotifications({
      now: new Date(),
      prefs,
      days,
    });
    if (!planned.length) return;
    try {
      await LocalNotifications.schedule({
        notifications: planned.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.at, allowWhileIdle: true },
          extra: { path: n.path },
          channelId: CHANNEL_ID,
          smallIcon: 'ic_stat_narracion',
        })),
      });
    } catch {
      /* exact-alarm denied etc. — prefs stay, no crash */
    }
  }

  private buildDays(prefs: DailyNotificationPrefs): DailyNotifDayInput[] {
    const now = new Date();
    const cached = this.palabra.loadCached();
    const days: DailyNotifDayInput[] = [];
    for (let i = 0; i < DAILY_NOTIF_HORIZON_DAYS; i++) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const saints = saintsOfDay(this.saints, date);
      const first = saints[0];
      const readings = lecturasForLiturgicalDate(liturgicalDateOf(date));
      const gospel = readings.find((r) => r.role === 'gospel');
      days.push({
        date,
        saintName: first ? calendarSaintLabel(first) : null,
        saintId: first?.id || null,
        gospelCite: gospel?.cite || null,
        reflectionPreview:
          prefs.reflection && cached?.reflection?.text
            ? snippet(cached.reflection.text, 80)
            : null,
      });
    }
    return days;
  }

  private async cancelPlanned(): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: allScheduledNotificationIds().map((id) => ({ id })),
      });
    } catch {
      /* ignore */
    }
  }

  private async ensureChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Lectura diaria',
        description: 'Santo, lecturas y lectio divina',
        importance: 4,
        visibility: 1,
      });
    } catch {
      /* already exists / web */
    }
  }

  private attachTapListener(): void {
    if (this.listenerAttached || !this.pluginAvailable()) return;
    this.listenerAttached = true;
    void LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (event) => {
        const path = (event?.notification?.extra as { path?: string } | undefined)
          ?.path;
        if (path && path.startsWith('/')) {
          void this.router.navigateByUrl(path);
        }
      },
    );
  }

  private pluginAvailable(): boolean {
    try {
      return typeof LocalNotifications?.schedule === 'function';
    } catch {
      return false;
    }
  }
}
