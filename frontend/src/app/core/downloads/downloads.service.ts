import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  DownloadsManifest,
  STABLE_DOWNLOAD_PATHS,
} from './downloads.models';
import {
  pickAppVersionForDisplay,
} from './version-display.logic';

/**
 * Resolves public download URLs for APK + Electron (Linux/Windows).
 * Prefers `/downloads/manifest.json` from the production tree; falls back to stable paths.
 *
 * Version reported by `getLinks()` is the **build-embedded** app version
 * (`environment.version`), not the assets stub — Capacitor cannot reach live
 * `/downloads` and the committed stub lags releases.
 */
@Injectable({ providedIn: 'root' })
export class DownloadsService {
  private readonly manifest$: Observable<DownloadsManifest>;

  constructor(private readonly http: HttpClient) {
    this.manifest$ = this.http
      .get<DownloadsManifest>(STABLE_DOWNLOAD_PATHS.manifest)
      .pipe(
        catchError(() =>
          this.http
            .get<DownloadsManifest>('assets/downloads/manifest.json')
            .pipe(catchError(() => of(this.fallbackManifest())))
        ),
        map((m) => this.normalize(m)),
        shareReplay(1)
      );
  }

  getManifest(): Observable<DownloadsManifest> {
    return this.manifest$;
  }

  /** Absolute same-origin paths ready for `<a href>`. */
  getLinks(): Observable<{
    apk: string;
    linux: string;
    windows: string;
    version: string;
  }> {
    return this.manifest$.pipe(
      map((m) => ({
        apk: m.downloads.apk || STABLE_DOWNLOAD_PATHS.apk,
        linux: m.downloads.linux || STABLE_DOWNLOAD_PATHS.linux,
        windows: m.downloads.windows || STABLE_DOWNLOAD_PATHS.windows,
        version: pickAppVersionForDisplay(
          environment.version,
          m.version
        ),
      }))
    );
  }

  private fallbackManifest(): DownloadsManifest {
    return {
      app: 'documentos-vaticanos',
      version: environment.version || '0.0.0',
      builtAt: null,
      downloads: {
        apk: STABLE_DOWNLOAD_PATHS.apk,
        linux: STABLE_DOWNLOAD_PATHS.linux,
        windows: STABLE_DOWNLOAD_PATHS.windows,
      },
    };
  }

  private normalize(m: DownloadsManifest | null | undefined): DownloadsManifest {
    const base = this.fallbackManifest();
    if (!m || typeof m !== 'object') {
      return base;
    }
    return {
      app: m.app || base.app,
      // Prefer build version when the assets/stub lags or is missing.
      version: pickAppVersionForDisplay(environment.version, m.version),
      builtAt: m.builtAt ?? null,
      downloads: {
        apk: m.downloads?.apk || base.downloads.apk,
        linux: m.downloads?.linux || base.downloads.linux,
        windows: m.downloads?.windows || base.downloads.windows,
      },
    };
  }
}
