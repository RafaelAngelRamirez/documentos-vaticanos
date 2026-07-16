import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { AuthService } from 'src/app/core/auth/auth.service';
import {
  UpdateAvailable,
} from 'src/app/core/downloads/app-update.logic';
import { AppUpdateService } from 'src/app/core/downloads/app-update.service';
import { BackupService } from 'src/app/services/backup.service';
import {
  ReaderFont,
  ReaderPreferences,
  ReaderPreferencesService,
  ReaderTheme,
} from 'src/app/services/reader-preferences.service';
import {
  NarratorService,
  NarratorVoice,
  narrVoicePillLabel,
} from 'src/app/services/narrator.service';
import {
  GrokServerStatus,
  NarratorDevicePrefs,
  NarratorPreferencesService,
  grokStatusLabel,
  maskXaiApiKey,
} from 'src/app/services/narrator-preferences.service';
import { environment } from 'src/environments/environment';

interface ThemeOption {
  value: ReaderTheme;
  label: string;
}

/** Pantalla 3H · Perfil y ajustes. */
@Component({
  standalone: true,
  selector: 'app-ajustes',
  imports: [CommonModule, AppFbarComponent, BnavComponent],
  templateUrl: './ajustes.component.html',
  styleUrls: ['./ajustes.component.css'],
})
export class AjustesComponent implements OnInit, OnDestroy {
  prefs: ReaderPreferences = this.readerPrefs.snapshot;

  /** Narrador — preferencias por dispositivo (localStorage). */
  narrPrefs: NarratorDevicePrefs = this.narratorPrefs.snapshot;
  narrVoices: NarratorVoice[] = [];
  narrVoice: NarratorVoice | null = null;
  grokStatus: GrokServerStatus = 'checking';
  grokVoiceCount = 0;
  /** Borrador del campo API key (no se muestra la guardada completa). */
  xaiKeyDraft = '';
  xaiKeyMsg: string | null = null;
  xaiKeyMsgError = false;

  /** Orden del diseño 3F + Mono (monocromo oscuro, default). */
  readonly themes: ThemeOption[] = [
    { value: 'mono', label: 'Mono' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'claro', label: 'Claro' },
    { value: 'oscuro', label: 'Oscuro' },
    { value: 'system', label: 'Sistema' },
  ];

  private sub = new Subscription();

  private wakeSentinel: { release?: () => Promise<void> } | null = null;

  private readonly visibilityListener = (): void => {
    if (this.prefs.keepAwake && document.visibilityState === 'visible') {
      void this.requestWakeLock();
    }
  };

  /** Sección Datos (F8c): mensaje de estado de export/import. */
  dataMsg: string | null = null;
  dataMsgError = false;
  importando = false;

  /** Actualización de instalador (APK / Electron) — null en web o sin update. */
  appUpdate: UpdateAvailable | null = null;
  readonly localVersion = environment.version || '';

  constructor(
    private readerPrefs: ReaderPreferencesService,
    private backup: BackupService,
    public auth: AuthService,
    private router: Router,
    private appUpdateSvc: AppUpdateService,
    private narrator: NarratorService,
    private narratorPrefs: NarratorPreferencesService
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.readerPrefs.prefs$.subscribe((p) => {
        this.prefs = p;
      })
    );
    this.sub.add(
      this.narratorPrefs.prefs$.subscribe((p) => {
        this.narrPrefs = p;
      })
    );
    this.sub.add(
      this.appUpdateSvc.availableUpdate$.subscribe((u) => {
        this.appUpdate = u;
      })
    );
    document.addEventListener('visibilitychange', this.visibilityListener);
    if (this.prefs.keepAwake) {
      void this.requestWakeLock();
    }
    void this.refreshNarratorSection();
  }

  downloadUpdate(): void {
    if (!this.appUpdate?.downloadUrl) {
      return;
    }
    this.appUpdateSvc.openDownload(this.appUpdate.downloadUrl);
  }

  dismissUpdate(): void {
    if (this.appUpdate?.version) {
      this.appUpdateSvc.dismiss(this.appUpdate.version);
    }
    this.appUpdate = null;
  }

  platformLabel(platform: string | undefined): string {
    switch (platform) {
      case 'apk':
        return 'Android (APK)';
      case 'linux':
        return 'Linux (AppImage)';
      case 'windows':
        return 'Windows';
      default:
        return 'instalador';
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    document.removeEventListener('visibilitychange', this.visibilityListener);
    void this.releaseWakeLock();
  }

  initials(name: string | undefined | null): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }

  bumpFont(delta: number): void {
    this.readerPrefs.bumpFontSize(delta);
  }

  setTheme(theme: ReaderTheme): void {
    this.readerPrefs.setTheme(theme);
  }

  setFont(font: ReaderFont): void {
    this.readerPrefs.setFont(font);
  }

  toggleKeepAwake(): void {
    const next = !this.prefs.keepAwake;
    this.readerPrefs.update({ keepAwake: next });
    if (next) {
      void this.requestWakeLock();
    } else {
      void this.releaseWakeLock();
    }
  }

  /** Ajustes · Narrador: voces Grok en este dispositivo. */
  toggleGrokEnabled(): void {
    this.narratorPrefs.toggleGrokEnabled();
    void this.refreshNarratorSection();
  }

  onXaiKeyInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.xaiKeyDraft = el?.value ?? '';
  }

  /** Guarda la API key solo en localStorage de este dispositivo. */
  saveXaiApiKey(): void {
    const raw = this.xaiKeyDraft.trim();
    if (!raw) {
      this.xaiKeyMsg = 'Pega una API key de console.x.ai.';
      this.xaiKeyMsgError = true;
      return;
    }
    this.narratorPrefs.setXaiApiKey(raw);
    this.xaiKeyDraft = '';
    this.xaiKeyMsg = 'Clave guardada en este dispositivo (no se sube a la nube).';
    this.xaiKeyMsgError = false;
    void this.refreshNarratorSection();
  }

  clearXaiApiKey(): void {
    this.narratorPrefs.clearXaiApiKey();
    this.xaiKeyDraft = '';
    this.xaiKeyMsg = 'Clave eliminada de este dispositivo.';
    this.xaiKeyMsgError = false;
    void this.refreshNarratorSection();
  }

  get xaiKeyMasked(): string {
    return maskXaiApiKey(this.narrPrefs.xaiApiKey);
  }

  get hasXaiKey(): boolean {
    return Boolean(this.narratorPrefs.xaiApiKey);
  }

  /** Cicla la voz preferida del dispositivo (sistema + Grok si aplica). */
  cycleNarrVoice(): void {
    if (this.narrVoices.length < 1) return;
    if (this.narrVoices.length === 1) {
      this.narrVoice = this.narrVoices[0];
      this.narratorPrefs.setVoiceId(this.narrVoice.id);
      return;
    }
    const i = this.narrVoice
      ? this.narrVoices.findIndex((v) => v.id === this.narrVoice!.id)
      : -1;
    this.narrVoice = this.narrVoices[(i + 1) % this.narrVoices.length];
    this.narratorPrefs.setVoiceId(this.narrVoice.id);
  }

  get narrVoiceName(): string {
    return this.narrVoice?.name ?? 'Voz del sistema';
  }

  get narrVoiceShort(): string {
    return narrVoicePillLabel(this.narrVoice, this.narrVoices);
  }

  get grokStatusText(): string {
    return grokStatusLabel(this.grokStatus);
  }

  get narrSupported(): boolean {
    return this.narrator.supported;
  }

  private async refreshNarratorSection(): Promise<void> {
    if (!this.narrator.supported) {
      this.narrVoices = [];
      this.narrVoice = null;
      this.grokStatus = 'offline';
      return;
    }
    this.grokStatus = 'checking';
    const probe = await this.narrator.probeGrokStatus();
    this.grokStatus = probe.status;
    this.grokVoiceCount = probe.voiceCount;
    this.narrVoices = await this.narrator.listVoices('es');
    const saved = this.narratorPrefs.voiceId;
    this.narrVoice =
      this.narrVoices.find((v) => v.id === saved) ??
      this.narrVoices[0] ??
      null;
    // Si la voz guardada ya no está (p. ej. Grok desactivado), alinear prefs.
    if (this.narrVoice && this.narrVoice.id !== saved) {
      this.narratorPrefs.setVoiceId(this.narrVoice.id);
    }
  }

  exportarDatos(): void {
    try {
      this.backup.exportar();
      this.setDataMsg('Copia de seguridad exportada: revisa tus descargas.');
    } catch {
      this.setDataMsg('No se pudo exportar la copia de seguridad.', true);
    }
  }

  async onImportarArchivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // Permite volver a elegir el mismo archivo.
    if (!file) return;
    this.importando = true;
    try {
      const resumen = await this.backup.importar(file);
      const partes = [`${resumen.anotaciones} anotaciones`];
      partes.push(
        resumen.preferencias
          ? 'preferencias de lectura restauradas'
          : 'sin preferencias en el archivo'
      );
      if (resumen.narrador) {
        partes.push('preferencias del narrador');
      }
      this.setDataMsg(
        `Datos importados (${partes.join(', ')}). La página se recargará…`
      );
    } catch (e) {
      this.setDataMsg(
        e instanceof Error ? e.message : 'No se pudo importar el archivo.',
        true
      );
    } finally {
      this.importando = false;
    }
  }

  private setDataMsg(msg: string, error = false): void {
    this.dataMsg = msg;
    this.dataMsgError = error;
  }

  goRefs(): void {
    this.router.navigate(['/cuenta/referencias']);
  }

  goThemes(): void {
    this.router.navigate(['/cuenta/temas']);
  }

  goCuenta(): void {
    this.router.navigate(['/cuenta']);
  }

  logout(): void {
    this.auth.logout();
  }

  get previewFontFamily(): string {
    return this.prefs.font === 'serif'
      ? "'EB Garamond', serif"
      : "'IBM Plex Sans', sans-serif";
  }

  private async requestWakeLock(): Promise<void> {
    try {
      const wakeLock = (
        navigator as unknown as {
          wakeLock?: {
            request: (
              type: string
            ) => Promise<{ release?: () => Promise<void> }>;
          };
        }
      ).wakeLock;
      if (!wakeLock) return;
      this.wakeSentinel = await wakeLock.request('screen');
    } catch {
      // Sin soporte o permiso denegado: el ajuste queda guardado igualmente.
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeSentinel?.release?.();
    } catch {
      // noop
    }
    this.wakeSentinel = null;
  }
}
