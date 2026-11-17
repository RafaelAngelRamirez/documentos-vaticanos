/** Public installer manifest shipped at `/downloads/manifest.json` (and assets stub). */
export interface DownloadsManifest {
  app: string;
  version: string | null;
  builtAt: string | null;
  available?: {
    apk?: boolean;
    linux?: boolean;
    windows?: boolean;
  } | null;
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

/**
 * Href for the Android installer.
 * `available.apk === false` means this publish did not build one: return null
 * so the page does not link a missing file. Absent flag keeps the stable path.
 */
export function publishedApkHref(manifest: {
  available?: { apk?: boolean } | null;
  downloads?: { apk?: string | null } | null;
} | null | undefined): string | null {
  if (manifest?.available?.apk === false) {
    return null;
  }
  const path = manifest?.downloads?.apk;
  if (typeof path === 'string' && path.trim()) {
    return path.trim();
  }
  return STABLE_DOWNLOAD_PATHS.apk;
}
