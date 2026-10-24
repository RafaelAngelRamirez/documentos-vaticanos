/**
 * Pure helpers: map monorepo semver → Android versionCode / versionName.
 * Used by package-aab.sh and unit-tested without Gradle.
 */
'use strict';

/**
 * @param {string} version semver like "0.0.20" or "v0.0.20"
 * @returns {{ versionName: string, versionCode: number }}
 */
function versionFromSemver(version) {
  const raw = String(version || '')
    .trim()
    .replace(/^v/i, '');
  const m = raw.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!m) {
    throw new Error(`invalid semver for Android versioning: ${JSON.stringify(version)}`);
  }
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (![major, minor, patch].every((n) => Number.isInteger(n) && n >= 0 && n <= 999)) {
    throw new Error(`semver components out of range (0-999): ${raw}`);
  }
  //  major*1_000_000 + minor*1_000 + patch  → unique increasing for normal bumps
  const versionCode = major * 1000000 + minor * 1000 + patch;
  return { versionName: raw, versionCode };
}

/**
 * @param {string} track user/env track name
 * @returns {string} Play Developer API track id (alpha | beta | production | internal | custom)
 */
function normalizePlayTrack(track) {
  const t = String(track || 'alpha')
    .trim()
    .toLowerCase();
  if (!t) return 'alpha';
  // Closed testing default track in Console is "alpha"
  if (t === 'closed' || t === 'closed-testing' || t === 'prueba-cerrada') return 'alpha';
  if (t === 'open' || t === 'open-testing' || t === 'prueba-abierta') return 'beta';
  if (t === 'internal' || t === 'prueba-interna') return 'internal';
  if (t === 'production' || t === 'prod' || t === 'produccion') return 'production';
  return t;
}

/**
 * Build the edits.tracks.update body for a completed bundle upload.
 * @param {{ track: string, versionCodes: number[], status?: string, userFraction?: number }} opts
 */
function buildTrackReleasePayload(opts) {
  const track = normalizePlayTrack(opts.track);
  const versionCodes = (opts.versionCodes || []).map((n) => Number(n));
  if (!versionCodes.length || versionCodes.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new Error('versionCodes must be non-empty positive integers');
  }
  const status = opts.status || 'completed';
  const release = {
    name: opts.releaseName || undefined,
    status,
    versionCodes: versionCodes.map(String),
  };
  if (status === 'inProgress' || status === 'halted') {
    if (opts.userFraction == null) {
      throw new Error('userFraction required for inProgress/halted');
    }
    release.userFraction = opts.userFraction;
  }
  // strip undefined
  Object.keys(release).forEach((k) => release[k] === undefined && delete release[k]);
  return {
    track,
    releases: [release],
  };
}

module.exports = {
  versionFromSemver,
  normalizePlayTrack,
  buildTrackReleasePayload,
};

if (require.main === module) {
  const v = process.argv[2] || require('../package.json').version;
  const out = versionFromSemver(v);
  process.stdout.write(JSON.stringify(out) + '\n');
}
