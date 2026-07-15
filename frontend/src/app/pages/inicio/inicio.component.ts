import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { DownloadsService } from 'src/app/core/downloads/downloads.service';
import { STABLE_DOWNLOAD_PATHS } from 'src/app/core/downloads/downloads.models';
import { NavigationService } from 'src/app/services/navigation.service';
import { environment } from 'src/environments/environment';

/**
 * Browser web shell only: not Capacitor native, not Electron packaged app.
 * Exported for unit tests of the gating logic used by the home screen.
 */
export function isWebDownloadShell(
  isNativePlatform: boolean = Capacitor.isNativePlatform(),
  isElectron: boolean = detectElectronShell()
): boolean {
  return !isNativePlatform && !isElectron;
}

/** Same Electron detection pattern as `app.module.ts` (preload flag or userAgent). */
export function detectElectronShell(): boolean {
  if (typeof window !== 'undefined') {
    const shell = (
      window as Window & {
        documentosVaticanosShell?: { kind?: string };
      }
    ).documentosVaticanosShell;
    if (shell?.kind === 'electron') {
      return true;
    }
  }
  return (
    typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)
  );
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
export class InicioComponent implements OnInit {
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
    private downloads: DownloadsService
  ) {}

  ngOnInit(): void {
    this.showDownloads = this.resolveShowDownloads();
    this.downloads.getLinks().subscribe((links) => {
      this.links = links;
      this.versionLabel = formatVersionLabel(
        links.version || environment.version
      );
    });
  }

  /** Platform gate; overridden in unit tests for web vs native shells. */
  resolveShowDownloads(): boolean {
    return isWebDownloadShell();
  }

  goDocuments(): void {
    this.navigation.go_to_documents();
  }

  goCuenta(): void {
    this.router.navigate(['/cuenta']);
  }
}
