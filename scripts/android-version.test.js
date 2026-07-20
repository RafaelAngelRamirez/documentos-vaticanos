/**
 * Unit tests for android-version helpers (real exported functions).
 * Run: node scripts/android-version.test.js
 */
'use strict';

const assert = require('assert');
const {
  versionFromSemver,
  normalizePlayTrack,
  buildTrackReleasePayload,
} = require('./android-version');

function section(n) {
  console.log(`\n== ${n} ==`);
}

function main() {
  section('versionFromSemver maps 0.0.20');
  let v = versionFromSemver('0.0.20');
  assert.strictEqual(v.versionName, '0.0.20');
  assert.strictEqual(v.versionCode, 20);
  assert.ok(v.versionCode >= 1);

  section('versionFromSemver strips v prefix; versionCode ignores prerelease');
  v = versionFromSemver('v1.2.3-beta.1');
  assert.strictEqual(v.versionName, '1.2.3-beta.1');
  assert.strictEqual(v.versionCode, 1002003);

  section('versionFromSemver rejects garbage');
  assert.throws(() => versionFromSemver('nope'), /invalid semver/);
  assert.throws(() => versionFromSemver(''), /invalid semver/);

  section('normalizePlayTrack closed → alpha');
  assert.strictEqual(normalizePlayTrack('closed'), 'alpha');
  assert.strictEqual(normalizePlayTrack('closed-testing'), 'alpha');
  assert.strictEqual(normalizePlayTrack('prueba-cerrada'), 'alpha');
  assert.strictEqual(normalizePlayTrack('alpha'), 'alpha');
  assert.strictEqual(normalizePlayTrack('internal'), 'internal');
  assert.strictEqual(normalizePlayTrack('production'), 'production');
  assert.strictEqual(normalizePlayTrack('open'), 'beta');
  assert.strictEqual(normalizePlayTrack('my-custom-track'), 'my-custom-track');
  assert.strictEqual(normalizePlayTrack(''), 'alpha');
  assert.strictEqual(normalizePlayTrack(undefined), 'alpha');

  section('buildTrackReleasePayload completed');
  const body = buildTrackReleasePayload({
    track: 'closed',
    versionCodes: [20],
    releaseName: '0.0.20',
  });
  assert.strictEqual(body.track, 'alpha');
  assert.strictEqual(body.releases.length, 1);
  assert.strictEqual(body.releases[0].status, 'completed');
  assert.deepStrictEqual(body.releases[0].versionCodes, ['20']);
  assert.strictEqual(body.releases[0].name, '0.0.20');

  section('buildTrackReleasePayload rejects empty versionCodes');
  assert.throws(
    () => buildTrackReleasePayload({ track: 'alpha', versionCodes: [] }),
    /versionCodes/
  );

  console.log('\nAll android-version tests passed.');
}

main();
