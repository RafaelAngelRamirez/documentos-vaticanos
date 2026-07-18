import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { UpdateAvailable } from 'src/app/core/downloads/app-update.logic';
import { AppUpdateService } from 'src/app/core/downloads/app-update.service';
import { DownloadsService } from 'src/app/core/downloads/downloads.service';
import { STABLE_DOWNLOAD_PATHS } from 'src/app/core/downloads/downloads.models';
import { pickAppVersionForDisplay } from 'src/app/core/downloads/version-display.logic';
import {
  detectElectronShell,
  isWebDownloadShell as isWebDownloadShellCore,
} from 'src/app/core/shell/shell.util';
import {
  briefSaintIntro,
  calendarSaintLabel,
  localFeastKey,
  localFeastLabelEs,
  saintsOfDay,
} from 'src/app/core/santoral/santoral-calendar.logic';
import { SaintRecord } from 'src/app/core/santoral/santoral-resolve.logic';
import { SantoralService } from 'src/app/core/santoral/santoral.service';
import { NavigationService } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';

// Re-export for existing unit tests / external imports.
export { detectElectronShell };

/**
 * Browser web shell only: not Capacitor native, not Electron packaged app.
 * Exported for unit tests of the gating logic used by the home screen.
 */
export function isWebDownloadShell(
  isNativePlatform: boolean = Capacitor.isNativePlatform(),
  isElectron: boolean = detectElectronShell()
): boolean {
  return isWebDownloadShellCore(isNativePlatform, isElectron);
}

/** Format app version for the welcome screen: `v` + semver. */
export function formatVersionLabel(version: string | null | undefined): string {
  const v = (version || '').trim();
  if (!v) {
    return '';
  }
  return v.startsWith('v') ? v : `v${v}`;
}

/**
 * Version label for the running build (Inicio · About).
 * See `pickAppVersionForDisplay` — never clobber with a lagging downloads stub.
 */
export function resolveAppVersionLabel(
  buildVersion: string | null | undefined = environment.version,
  manifestVersion?: string | null
): string {
  return formatVersionLabel(
    pickAppVersionForDisplay(buildVersion, manifestVersion)
  );
}

/** Pantalla 3A · Bienvenida (+ santos del día offline). */
@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule, RouterModule],
})
export class InicioComponent implements OnInit, OnDestroy {
  /** Quick-download icons only on public web (not native / Electron shell). */
  showDownloads = false;

  links: {
    apk: string;
    linux: string;
    windows: string;
    version: string;
  } = {
    apk: STABLE_DOWNLOAD_PATHS.apk,
    linux: STABLE_DOWNLOAD_PATHS.linux,
    windows: STABLE_DOWNLOAD_PATHS.windows,
    version: environment.version || '',
  };

  /**
   * e.g. `v0.0.16` — always the build-embedded app version (never the downloads
   * manifest, which lags on the Capacitor assets stub).
   */
  versionLabel = resolveAppVersionLabel(environment.version);

  /** Packaged shell (APK/Electron): non-blocking update offer. */
  appUpdate: UpdateAvailable | null = null;

  /** Offline pack saints for today (MM-DD local). */
  saintsToday: SaintRecord[] = [];
  /** Human date label, e.g. "18 de julio". */
  feastLabelEs = '';
  feastKeyToday = '';
  saintsTodayLoading = true;
  saintsTodayError = false;

  private sub = new Subscription();

  get windowsDownloadName(): string {
    const href = this.links.windows || '';
    if (href.endsWith('.zip')) {
      return 'documentos-vaticanos-windows.zip';
    }
    return 'documentos-vaticanos-windows.exe';
  }

  constructor(
    private navigation: NavigationService,
    private router: Router,
    private downloads: DownloadsService,
    private appUpdateSvc: AppUpdateService,
    private santoral: SantoralService,
  ) {}

  ngOnInit(): void {
    this.showDownloads = this.resolveShowDownloads();
    // Installer hrefs only — version label stays on environment.version.
    this.sub.add(
      this.downloads.getLinks().subscribe((links) => {
        this.links = {
          ...links,
          // Keep build version for any consumer of links.version on this screen.
          version: environment.version || links.version || '',
        };
      })
    );
    // Only meaningful on APK/Electron (service is no-op on pure web).
    this.sub.add(
      this.appUpdateSvc.availableUpdate$.subscribe((u) => {
        this.appUpdate = u;
      })
    );

    const now = new Date();
    this.feastKeyToday = localFeastKey(now);
    this.feastLabelEs = localFeastLabelEs(now);
    this.sub.add(
      this.santoral.loadManifest().subscribe({
        next: (m) => {
          this.saintsToday = saintsOfDay(m.saints || [], now) as SaintRecord[];
          this.saintsTodayLoading = false;
          this.saintsTodayError = false;
        },
        error: () => {
          this.saintsToday = [];
          this.saintsTodayLoading = false;
          this.saintsTodayError = true;
        },
      }),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /** Platform gate; overridden in unit tests for web vs native shells. */
  resolveShowDownloads(): boolean {
    return isWebDownloadShell();
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

  goDocuments(): void {
    this.navigation.go_to_documents();
  }

  goCuenta(): void {
    this.router.navigate(['/cuenta']);
  }

  goSantoral(): void {
    this.router.navigate(['/santoral']);
  }

  goSantoralCalendario(): void {
    this.router.navigate(['/santoral'], {
      queryParams: { vista: 'calendario' },
    });
  }

  openSaint(s: SaintRecord): void {
    if (!s?.id) return;
    this.router.navigate(['/santoral', s.id]);
  }

  saintLabel(s: SaintRecord): string {
    return calendarSaintLabel(s);
  }

  saintIntro(s: SaintRecord): string {
    return briefSaintIntro(s, 140);
  }
}
