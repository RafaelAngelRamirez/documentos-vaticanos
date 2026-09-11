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
  assert.match(aabSh, /ensure_frontend_deps/);
  assert.match(aabSh, /node_modules\/\.bin\/ng/);
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
  // Play must be after docker deploy (post-build), not before packaging.
  const aabIdx = ci.indexOf('package-aab.sh');
  const deployIdx = ci.indexOf('ci-deploy-docvat.sh');
  const playIdx = ci.indexOf('play-upload-closed.js');
  assert.ok(aabIdx > 0 && deployIdx > aabIdx, 'AAB before docker deploy');
  assert.ok(playIdx > deployIdx, 'Play upload after docker deploy (post-build)');
  assert.match(ci, /googleapis/);
  assert.match(ci, /PLAY_STATUS/);

  section('root package declares googleapis for Play API client');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies && pkg.dependencies.googleapis, 'googleapis in dependencies');

  section('n8n workflow passes Play env names');
  const wf = fs.readFileSync(path.join(ROOT, 'deploy/DOCVAT-build-v1-sidecar.json'), 'utf8');
  assert.match(wf, /DV_PLAY_UPLOAD/);
  assert.match(wf, /PLAY_SERVICE_ACCOUNT_JSON/);
  assert.match(wf, /DV_KEYSTORE_PATH/);
  assert.match(wf, /scripts\/package-apk\.sh/);
  assert.match(wf, /\.ci-build\.sh/);
  assert.match(wf, /DV_PACKAGE_NAME:-com\.docvat/);
  assert.match(wf, /DV_PLAY_UPLOAD:-0/, 'sidecar web build defers Play to idle job');
  assert.match(wf, /PLAY_STATUS:-completed/);
  assert.match(wf, /DOCVAT_SECRETS_MOUNT/);

  section('PLAY-publish idle job mounts Docvat secrets (not Imperium fallback)');
  const playWf = fs.readFileSync(path.join(ROOT, 'deploy/PLAY-publish-v1.json'), 'utf8');
  assert.match(playWf, /DOCVAT_SECRETS_MOUNT/);
  assert.match(playWf, /\/home\/deploy\/secrets\/docvat/);
  assert.ok(
    !playWf.includes('SECRETS_MOUNT%%'),
    'must not test -d ${SECRETS_MOUNT%%:*} inside n8n (host paths are invisible there)',
  );
  assert.match(playWf, /appId === 'docvat' \? 'com\.docvat'/);
  assert.match(playWf, /appId === 'docvat' \? 'completed'/);
  assert.match(playWf, /bash scripts\/package-aab\.sh/);
  assert.match(playWf, /play-upload-closed\.js/);
  assert.ok(!/test -d \/home\/deploy\/secrets/.test(playWf));
  assert.ok(!/IM_SECRETS_MOUNT/.test(wf), 'sidecar JSON must not use IM_SECRETS_MOUNT');

  section('n8n sidecar + PLAY-publish JSON contracts (sibling)');
  require('./n8n-play.structure.test.js').main();

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
