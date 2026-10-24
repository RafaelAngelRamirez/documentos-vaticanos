import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

/**
 * 5E · Narración en segundo plano (Android).
 *
 * Mantiene un *foreground service* (tipo `mediaPlayback`, declarado en el
 * AndroidManifest) mientras el narrador lee. Sin él, Android congela el
 * proceso del WebView al apagar la pantalla o pasar la app a segundo plano
 * y la cadena de párrafos se detiene al terminar la locución en curso.
 *
 * - `start()` es idempotente: se puede invocar en cada párrafo sin coste.
 * - En web / iOS todos los métodos son no-op.
 * - En Android 13+ solicita el permiso de notificaciones la primera vez
 *   (si se deniega, el servicio funciona igual; solo se oculta el aviso).
 */
@Injectable({ providedIn: 'root' })
export class NarracionFgService {
  private static readonly NOTIFICATION_ID = 5150;

  private readonly android = Capacitor.getPlatform() === 'android';
  private active = false;
  private permissionChecked = false;

  /** Arranca (o mantiene) el servicio; `body` es el título del documento. */
  async start(body: string): Promise<void> {
    if (!this.android || this.active) return;
    this.active = true;
    try {
      await this.ensureNotificationPermission();
      await ForegroundService.startForegroundService({
        id: NarracionFgService.NOTIFICATION_ID,
        title: 'Narración en curso',
        body: body || 'Documentos Vaticanos',
        smallIcon: 'ic_stat_narracion',
      });
    } catch {
      // Sin servicio la narración sigue funcionando con la app visible.
      this.active = false;
    }
  }

  /** Detiene el servicio y retira la notificación. */
  async stop(): Promise<void> {
    if (!this.android || !this.active) return;
    this.active = false;
    await ForegroundService.stopForegroundService().catch(() => undefined);
  }

  /** Android 13+: pide permiso de notificaciones una sola vez por sesión. */
  private async ensureNotificationPermission(): Promise<void> {
    if (this.permissionChecked) return;
    this.permissionChecked = true;
    try {
      const { display } = await ForegroundService.checkPermissions();
      // Cualquier estado «prompt*» → pedir; granted/denied → no molestar.
      if (display !== 'granted' && display !== 'denied') {
        await ForegroundService.requestPermissions();
      }
    } catch {
      /* permiso opcional: continuar sin notificación visible */
    }
  }
}
