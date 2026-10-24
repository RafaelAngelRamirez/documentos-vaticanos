/**
 * Pure app-update resolution (no Angular, no network).
 * Self-contained so node tests can load it via --experimental-strip-types.
 */

/** Installer platforms published in the downloads manifest. */
export type UpdatePlatform = 'apk' | 'linux' | 'windows';

/** Minimal manifest shape needed for update resolution. */
export interface UpdateManifestInput {
  version?: string | null;
  downloads?: {
    apk?: string | null;
    linux?: string | null;
    windows?: string | null;
  } | null;
}

/** Stable installer paths (mirrors downloads.models STABLE_DOWNLOAD_PATHS). */
export const UPDATE_STABLE_PATHS: Record<UpdatePlatform, string> & {
  manifest: string;
} = {
  apk: '/downloads/documentos-vaticanos.apk',
  linux: '/downloads/documentos-vaticanos-linux.AppImage',
  windows: '/downloads/documentos-vaticanos-windows.exe',
  manifest: '/downloads/manifest.json',
};

export interface UpdateAvailable {
  available: true;
  version: string;
  downloadUrl: string;
  platform: UpdatePlatform;
  localVersion: string;
}

export interface UpdateNotAvailable {
  available: false;
  reason:
    | 'same_or_older'
    | 'invalid_local'
    | 'invalid_remote'
    | 'missing_path'
    | 'no_platform'
    | 'no_manifest';
}

export type UpdateResolution = UpdateAvailable | UpdateNotAvailable;

/**
 * Parse a loose semver (optional leading `v`, optional pre-release suffix).
 * Returns null when the core major.minor.patch cannot be read.
 */
export function parseSemver(
  version: string | null | undefined
): [number, number, number] | null {
  if (version == null || typeof version !== 'string') {
    return null;
  }
  const trimmed = version.trim().replace(/^v/i, '');
  if (!trimmed) {
    return null;
  }
  // Take core before pre-release / build metadata
  const core = trimmed.split(/[-+]/)[0] || '';
  const parts = core.split('.');
  if (parts.length < 1 || parts.length > 3) {
    return null;
  }
  const nums: number[] = [0, 0, 0];
  for (let i = 0; i < parts.length; i++) {
    const n = Number(parts[i]);
    if (!Number.isFinite(n) || n < 0 || !/^\d+$/.test(parts[i])) {
      return null;
    }
    nums[i] = n;
  }
  return [nums[0], nums[1], nums[2]];
}

/**
 * Compare two semver strings.
 * @returns negative if a < b, 0 if equal, positive if a > b, null if either invalid
 */
export function compareSemver(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    return null;
  }
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

/** True only when remote is strictly greater than local (both valid). */
export function isRemoteNewer(
  localVersion: string | null | undefined,
  remoteVersion: string | null | undefined
): boolean {
  const cmp = compareSemver(localVersion, remoteVersion);
  return cmp != null && cmp < 0;
}

/**
 * Detect which installer platform applies to this shell.
 * Android Capacitor → apk; Electron → linux/windows from process/userAgent;
 * pure web browser → null (no native update prompt).
 */
export function detectUpdatePlatform(opts: {
  isNativePlatform: boolean;
  isElectron: boolean;
  userAgent?: string;
  processPlatform?: string;
}): UpdatePlatform | null {
  if (opts.isNativePlatform) {
    return 'apk';
  }
  if (!opts.isElectron) {
    return null;
  }
  const pp = (opts.processPlatform || '').toLowerCase();
  if (pp === 'win32' || pp === 'windows') {
    return 'windows';
  }
  if (pp === 'linux') {
    return 'linux';
  }
  if (pp === 'darwin' || pp === 'macos') {
    // No macOS installer published yet; treat as no platform path.
    return null;
  }
  const ua = opts.userAgent || '';
  if (/Windows/i.test(ua)) {
    return 'windows';
  }
  // Electron on Linux (default packaged target)
  if (/Linux/i.test(ua) || /Electron/i.test(ua)) {
    return 'linux';
  }
  return 'linux';
}

/** Join public origin + relative `/downloads/...` path into an absolute URL. */
export function absolutizeDownloadUrl(
  pathOrUrl: string | null | undefined,
  downloadsOrigin: string
): string | null {
  if (pathOrUrl == null || typeof pathOrUrl !== 'string') {
    return null;
  }
  const raw = pathOrUrl.trim();
  if (!raw) {
    return null;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const origin = (downloadsOrigin || '').replace(/\/+$/, '');
  if (!origin) {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${origin}${path}`;
}

/**
 * Resolve whether a remote downloads manifest offers a newer installer for
 * the given platform. Pure: no I/O; failures → available:false (never throws).
 */
export function resolveUpdate(
  localVersion: string | null | undefined,
  manifest: UpdateManifestInput | null | undefined,
  platform: UpdatePlatform | null,
  downloadsOrigin: string
): UpdateResolution {
  if (!platform) {
    return { available: false, reason: 'no_platform' };
  }
  if (!manifest || typeof manifest !== 'object') {
    return { available: false, reason: 'no_manifest' };
  }
  const local = parseSemver(localVersion);
  if (!local) {
    return { available: false, reason: 'invalid_local' };
  }
  const remoteVer = manifest.version;
  if (!parseSemver(remoteVer)) {
    return { available: false, reason: 'invalid_remote' };
  }
  if (!isRemoteNewer(localVersion, remoteVer)) {
    return { available: false, reason: 'same_or_older' };
  }
  const rel =
    (manifest.downloads && manifest.downloads[platform]) ||
    UPDATE_STABLE_PATHS[platform] ||
    null;
  const downloadUrl = absolutizeDownloadUrl(rel, downloadsOrigin);
  if (!downloadUrl) {
    return { available: false, reason: 'missing_path' };
  }
  return {
    available: true,
    version: String(remoteVer).trim().replace(/^v/i, ''),
    downloadUrl,
    platform,
    localVersion: String(localVersion || '').trim().replace(/^v/i, ''),
  };
}

/** Absolute URL of the public remote downloads manifest. */
export function remoteManifestUrl(downloadsOrigin: string): string {
  const origin = (downloadsOrigin || '').replace(/\/+$/, '');
  const path = UPDATE_STABLE_PATHS.manifest;
  if (!origin) {
    return path;
  }
  return `${origin}${path}`;
}

/**
 * Whether the shell should auto-check for native installers.
 * Web browser: false; Capacitor native or Electron: true.
 */
export function shouldAutoCheckAppUpdate(opts: {
  isNativePlatform: boolean;
  isElectron: boolean;
}): boolean {
  return !!(opts.isNativePlatform || opts.isElectron);
}
