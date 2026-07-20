/**
 * Structural gates for AAB packaging + Play closed-upload wiring.
 * Does not require a keystore or network.
 * Run: node scripts/package-aab.structure.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function section(n) {
  console.log(`\n== ${n} ==`);
}

function main() {
  section('scripts exist and are executable paths');
  for (const rel of [
    'scripts/package-aab.sh',
    'scripts/play-upload-closed.js',
    'scripts/android-version.js',
    'deploy/PLAY-CLOSED-TESTING.md',
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), rel);
  }

  section('build.gradle accepts -Pdv signing + version props');
  const gradle = fs.readFileSync(path.join(ROOT, 'frontend/android/app/build.gradle'), 'utf8');
  assert.match(gradle, /dvVersionCode/);
  assert.match(gradle, /dvVersionName/);
  assert.match(gradle, /dvApplicationId/);
  assert.match(gradle, /signingConfigs/);
  assert.match(gradle, /dvStoreFile/);
  assert.match(gradle, /hasReleaseSigning/);

  section('package-aab.sh wires secrets via env (not hardcoded passwords)');
  const aabSh = fs.readFileSync(path.join(ROOT, 'scripts/package-aab.sh'), 'utf8');
  assert.match(aabSh, /DV_KEYSTORE_PATH/);
  assert.match(aabSh, /DV_KEYSTORE_PASSWORD/);
  assert.match(aabSh, /bundleRelease/);
  assert.match(aabSh, /dvStorePassword/);
  assert.ok(!/docvat-local-dev-only/.test(aabSh), 'no local keystore password in script');

  section('play-upload-closed uses real helpers + closed→alpha');
  const up = fs.readFileSync(path.join(ROOT, 'scripts/play-upload-closed.js'), 'utf8');
  assert.match(up, /buildTrackReleasePayload/);
  assert.match(up, /normalizePlayTrack/);
  assert.match(up, /PLAY_SERVICE_ACCOUNT_JSON/);
  assert.match(up, /edits\.insert|androidpublisher/);

  section('CI optional AAB + upload');
  const ci = fs.readFileSync(path.join(ROOT, '.ci-build.sh'), 'utf8');
  assert.match(ci, /package-aab\.sh/);
  assert.match(ci, /play-upload-closed\.js/);
  assert.match(ci, /DV_PLAY_UPLOAD/);

  section('n8n workflow passes Play env names');
  const wf = fs.readFileSync(path.join(ROOT, 'deploy/DOCVAT-build-v1-sidecar.json'), 'utf8');
  assert.match(wf, /DV_PLAY_UPLOAD/);
  assert.match(wf, /PLAY_SERVICE_ACCOUNT_JSON/);
  assert.match(wf, /DV_KEYSTORE_PATH/);

  section('ops docs: package id, track, secrets names, import');
  const docs = fs.readFileSync(path.join(ROOT, 'deploy/PLAY-CLOSED-TESTING.md'), 'utf8');
  assert.match(docs, /com\.docvat/);
  assert.match(docs, /alpha/);
  assert.match(docs, /PLAY_SERVICE_ACCOUNT_JSON/);
  assert.match(docs, /n8n import:workflow/);
  assert.match(docs, /Playwright/);
  assert.ok(!/BEGIN PRIVATE KEY|docvat-local-dev-only/.test(docs), 'no secrets in docs');

  console.log('\nAll package-aab structure tests passed.');
}

main();
