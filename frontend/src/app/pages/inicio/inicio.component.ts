import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Subscription } from 'rxjs';
import { UpdateAvailable } from 'src/app/core/downloads/app-update.logic';
import { AppUpdateService } from 'src/app/core/downloads/app-update.service';
import { DownloadsService } from 'src/app/core/downloads/downloads.service';
import { STABLE_DOWNLOAD_PATHS } from 'src/app/core/downloads/downloads.models';
import {
  detectElectronShell,
  isWebDownloadShell as isWebDownloadShellCore,
} from 'src/app/core/shell/shell.util';
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
  const v = (version || environment.version || '').trim();
  if (!v) {
    return '';
  }
  return v.startsWith('v') ? v : `v${v}`;
}

/** Pantalla 3A · Bienvenida. */
@Component({
  standalone: true,
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.css'],
  imports: [CommonModule],
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

  /** e.g. `v0.0.13` — always from known app version, never hard-coded in the template. */
  versionLabel = formatVersionLabel(environment.version);

  /** Packaged shell (APK/Electron): non-blocking update offer. */
  appUpdate: UpdateAvailable | null = null;

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
    private appUpdateSvc: AppUpdateService
  ) {}

  ngOnInit(): void {
    this.showDownloads = this.resolveShowDownloads();
    this.sub.add(
      this.downloads.getLinks().subscribe((links) => {
        this.links = links;
        this.versionLabel = formatVersionLabel(
          links.version || environment.version
        );
      })
    );
    // Only meaningful on APK/Electron (service is no-op on pure web).
    this.sub.add(
      this.appUpdateSvc.availableUpdate$.subscribe((u) => {
        this.appUpdate = u;
      })
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
}
