import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppFbarComponent } from 'src/app/components/app-fbar/app-fbar.component';
import { BnavComponent } from 'src/app/components/bnav/bnav.component';
import { AuthService } from 'src/app/core/auth/auth.service';
import {
  ReaderFont,
  ReaderPreferences,
  ReaderPreferencesService,
  ReaderTheme,
} from 'src/app/services/reader-preferences.service';

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

  /** Orden exacto del diseño 3F. */
  readonly themes: ThemeOption[] = [
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

  constructor(
    private readerPrefs: ReaderPreferencesService,
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.readerPrefs.prefs$.subscribe((p) => {
        this.prefs = p;
      })
    );
    document.addEventListener('visibilitychange', this.visibilityListener);
    if (this.prefs.keepAwake) {
      void this.requestWakeLock();
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
