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
  assert.strictEqual(body.releases[0].status, 'completed'); // explicit status in opts
  assert.deepStrictEqual(body.releases[0].versionCodes, ['20']);
  assert.strictEqual(body.releases[0].name, '0.0.20');

  section('buildTrackReleasePayload draft status (Borrador-safe)');
  const draft = buildTrackReleasePayload({
    track: 'closed',
    versionCodes: [21],
    releaseName: '0.0.21',
    status: 'draft',
  });
  assert.strictEqual(draft.track, 'alpha');
  assert.strictEqual(draft.releases[0].status, 'draft');
  assert.deepStrictEqual(draft.releases[0].versionCodes, ['21']);

  section('buildTrackReleasePayload rejects empty versionCodes');
  assert.throws(
    () => buildTrackReleasePayload({ track: 'alpha', versionCodes: [] }),
    /versionCodes/
  );

  section('monorepo semver maps above currently shipped 0.0.23 / code 23');
  const fs = require('fs');
  const path = require('path');
  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  const shipped = versionFromSemver(rootPkg.version);
  assert.notStrictEqual(shipped.versionName, '1.0');
  assert.ok(
    shipped.versionCode > 23,
    `versionCode ${shipped.versionCode} must be > 23 (APK replace)`
  );
  assert.strictEqual(shipped.versionName, rootPkg.version.replace(/^v/i, ''));

  section('package-apk.sh injects -PdvVersionCode / -PdvVersionName from helper');
  const apkSh = fs.readFileSync(
    path.join(__dirname, 'package-apk.sh'),
    'utf8'
  );
  assert.ok(apkSh.includes('android-version.js'), 'uses version helper');
  assert.ok(apkSh.includes('-PdvVersionCode=${VERSION_CODE}'));
  assert.ok(apkSh.includes('-PdvVersionName=${VERSION_NAME}'));
  assert.ok(apkSh.includes('assembleDebug'));
  assert.ok(
    !/assembleDebug --no-daemon\s*$/m.test(
      apkSh.replace(/\\/g, '')
    ) || apkSh.includes('-PdvVersionCode'),
    'assembleDebug is not the bare Gradle fallback'
  );

  console.log('\nAll android-version tests passed.');
}

main();
