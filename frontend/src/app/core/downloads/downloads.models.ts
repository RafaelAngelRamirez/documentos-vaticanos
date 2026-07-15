/** Public installer manifest shipped at `/downloads/manifest.json` (and assets stub). */
export interface DownloadsManifest {
  app: string;
  version: string;
  builtAt: string | null;
  downloads: {
    apk: string | null;
    linux: string | null;
    windows: string | null;
  };
}

/** Stable paths used by the UI when the manifest is missing. */
export const STABLE_DOWNLOAD_PATHS = {
  apk: '/downloads/documentos-vaticanos.apk',
  linux: '/downloads/documentos-vaticanos-linux.AppImage',
  windows: '/downloads/documentos-vaticanos-windows.exe',
  manifest: '/downloads/manifest.json',
} as const;
