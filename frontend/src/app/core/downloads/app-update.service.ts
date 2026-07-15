import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { DownloadsManifest } from './downloads.models';
import {
  UpdateAvailable,
  UpdateResolution,
  detectUpdatePlatform,
  remoteManifestUrl,
  resolveUpdate,
  shouldAutoCheckAppUpdate,
} from './app-update.logic';
import { detectElectronShell } from 'src/app/core/shell/shell.util';

const DISMISS_KEY = 'dv.appUpdate.dismissedVersion';

type ShellBridge = {
  kind?: string;
  openExternal?: (url: string) => void | Promise<void>;
  platform?: string;
};

/**
 * Checks the public production downloads manifest for a newer installer.
 * Active on Capacitor (APK) and Electron only; silent no-op on web browser.
 * Network / JSON / CORS failures never throw and never block the offline reader.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly state$ = new BehaviorSubject<UpdateResolution | null>(null);
  private checked = false;

  constructor(private readonly http: HttpClient) {
    // Fire-and-forget on construct so any shell that injects the service starts a check.
    // Safe: only native/Electron hit the network; web short-circuits.
    this.checkForUpdate();
  }

  /** Latest resolution (null while not yet checked or web no-op). */
  get update$(): Observable<UpdateResolution | null> {
    return this.state$.asObservable();
  }

  get snapshot(): UpdateResolution | null {
    return this.state$.value;
  }

  /** Convenience: available update if any and not dismissed for that version. */
  get availableUpdate$(): Observable<UpdateAvailable | null> {
    return this.state$.pipe(
      map((r) => {
        if (!r || !r.available) {
          return null;
        }
        if (this.isDismissed(r.version)) {
          return null;
        }
        return r;
      })
    );
  }

  /**
   * Run (or re-run) the remote check. Idempotent for the first auto call;
   * pass force=true from Ajustes "Buscar actualización".
   */
  checkForUpdate(force = false): void {
    if (this.checked && !force) {
      return;
    }
    this.checked = true;

    const isNative = Capacitor.isNativePlatform();
    const isElectron = detectElectronShell();
    if (
      !shouldAutoCheckAppUpdate({
        isNativePlatform: isNative,
        isElectron,
      })
    ) {
      this.state$.next({ available: false, reason: 'no_platform' });
      return;
    }

    const origin = (
      environment.downloadsPublicOrigin ||
      'https://docvat.codice-progressio.online'
    ).replace(/\/+$/, '');
    const url = remoteManifestUrl(origin);
    const platform = detectUpdatePlatform({
      isNativePlatform: isNative,
      isElectron,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      processPlatform: this.electronProcessPlatform(),
    });

    this.http
      .get<DownloadsManifest>(url, {
        // Avoid interceptor attaching JWT to a public CDN/static host
        headers: { Accept: 'application/json' },
      })
      .pipe(
        take(1),
        map((manifest) =>
          resolveUpdate(environment.version, manifest, platform, origin)
        ),
        catchError(() =>
          of(
            resolveUpdate(environment.version, null, platform, origin)
          ) as Observable<UpdateResolution>
        )
      )
      .subscribe((resolution) => {
        this.state$.next(resolution);
      });
  }

  /** Remember that the user dismissed this remote version (local only). */
  dismiss(version: string): void {
    try {
      localStorage.setItem(DISMISS_KEY, version);
    } catch {
      // private mode / blocked storage
    }
    // Re-emit so availableUpdate$ hides the banner
    const cur = this.state$.value;
    if (cur) {
      this.state$.next({ ...cur });
    }
  }

  isDismissed(version: string): boolean {
    try {
      return localStorage.getItem(DISMISS_KEY) === version;
    } catch {
      return false;
    }
  }

  /**
   * Open the installer download URL in the system browser / external handler
   * (manual download — never silent install).
   */
  openDownload(url: string): void {
    if (!url) {
      return;
    }
    const shell = this.shellBridge();
    if (shell?.openExternal) {
      try {
        void shell.openExternal(url);
        return;
      } catch {
        // fall through
      }
    }
    // Capacitor / browser: open in a new context so the WebView is not replaced
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        // Popup blocked: navigate top-level as last resort
        window.location.assign(url);
      }
    } catch {
      try {
        window.location.assign(url);
      } catch {
        // ignore
      }
    }
  }

  private shellBridge(): ShellBridge | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    return (window as Window & { documentosVaticanosShell?: ShellBridge })
      .documentosVaticanosShell;
  }

  private electronProcessPlatform(): string | undefined {
    const shell = this.shellBridge();
    return shell?.platform;
  }
}
