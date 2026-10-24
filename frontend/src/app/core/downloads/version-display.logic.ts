/**
 * Pure helpers for the app version shown in UI (Inicio, About, downloads links).
 * No Angular / no network — loadable from Node tests via --experimental-strip-types.
 */

/**
 * Parse loose semver core (optional leading `v`). Returns null if unreadable.
 */
export function parseVersionCore(
  version: string | null | undefined
): [number, number, number] | null {
  if (version == null || typeof version !== 'string') {
    return null;
  }
  const trimmed = version.trim().replace(/^v/i, '');
  if (!trimmed) {
    return null;
  }
  const core = trimmed.split(/[-+]/)[0] || '';
  const parts = core.split('.');
  if (parts.length < 1 || parts.length > 3) {
    return null;
  }
  const nums: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d+$/.test(parts[i])) {
      return null;
    }
    const n = Number(parts[i]);
    if (!Number.isFinite(n) || n < 0) {
      return null;
    }
    nums[i] = n;
  }
  return nums;
}

/** Compare two semver cores: negative if a < b, 0 equal, positive if a > b. */
export function compareVersionCore(
  a: string | null | undefined,
  b: string | null | undefined
): number | null {
  const pa = parseVersionCore(a);
  const pb = parseVersionCore(b);
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

/**
 * Version string for "this running app" UI.
 *
 * Always prefer `buildVersion` (environment.version from the Angular build /
 * standard-version). The downloads manifest is only a source of installer
 * paths; on Capacitor the committed `assets/downloads/manifest.json` stub
 * often lags releases and must not pin the home-screen label to an old value.
 *
 * If buildVersion is missing/invalid, fall back to manifestVersion so web
 * still shows something when environment was not filled.
 */
export function pickAppVersionForDisplay(
  buildVersion: string | null | undefined,
  manifestVersion?: string | null | undefined
): string {
  const build = (buildVersion || '').trim().replace(/^v/i, '');
  const manifest = (manifestVersion || '').trim().replace(/^v/i, '');

  if (parseVersionCore(build)) {
    // If both valid and manifest is strictly newer (e.g. web served a fresh
    // /downloads/manifest after a partial deploy), still prefer build: the
    // label means "this pack", not "latest installer on the CDN".
    return build;
  }
  if (parseVersionCore(manifest)) {
    return manifest;
  }
  return build || manifest || '';
}
