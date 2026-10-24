/**
 * Structural gates for n8n sidecar + PLAY idle job vs real packagers.
 * Drives deploy/DOCVAT-build-v1-sidecar.json and deploy/PLAY-publish-v1.json.
 * Does not reimplement workflows. Run: node scripts/n8n-play.structure.test.js
 * Also invoked from package-aab.structure.test.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function section(n) {
  console.log(`\n== ${n} ==`);
}

function loadWorkflow(rel) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  const wf = Array.isArray(raw) ? raw[0] : raw;
  assert.ok(wf && typeof wf === 'object', rel);
  return wf;
}

function nodeById(wf, id) {
  const n = (wf.nodes || []).find((x) => x.id === id);
  assert.ok(n, `missing n8n node id=${id}`);
  return n;
}

function main() {
  section('sidecar id + Build sidecar invokes .ci-build.sh / package-apk.sh');
  const sidecar = loadWorkflow('deploy/DOCVAT-build-v1-sidecar.json');
  assert.strictEqual(sidecar.id, 'DOCVATBuildV1sc');
  const buildCmd = String(nodeById(sidecar, 'docvat-build-sidecar').parameters.command || '');
  assert.match(buildCmd, /test -f \.ci-build\.sh/);
  assert.match(buildCmd, /test -f scripts\/package-apk\.sh/);
  assert.match(buildCmd, /bash \/work\/docvat\/\.ci-build\.sh/);
  assert.ok(
    !/assembleDebug/.test(buildCmd),
    'sidecar must not gradle assembleDebug itself (package-apk.sh owns -PdvVersion*)',
  );
  assert.ok(
    !/gradlew/.test(buildCmd),
    'sidecar must not invoke gradlew (APK version injection lives in package-apk.sh)',
  );

  section('sidecar defers Play (DV_PLAY_UPLOAD default 0) and mounts Docvat secrets');
  assert.match(buildCmd, /DV_PLAY_UPLOAD="\$\{DV_PLAY_UPLOAD:-0\}"/);
  assert.match(buildCmd, /\$\{DOCVAT_SECRETS_MOUNT:\+-v \$DOCVAT_SECRETS_MOUNT\}/);
  assert.ok(!/IM_SECRETS_MOUNT/.test(buildCmd), 'sidecar must not mount Imperium secrets');
  assert.ok(
    !/\/home\/deploy\/secrets\/imperium/.test(buildCmd),
    'sidecar must not bind-mount Imperium /home/deploy/secrets/imperium',
  );
  // Host can override DV_PLAY_UPLOAD=1, but the snapshot default is defer-to-idle.
  assert.ok(
    !/DV_PLAY_UPLOAD="\$\{DV_PLAY_UPLOAD:-1\}"/.test(buildCmd),
    'must not default DV_PLAY_UPLOAD to 1 on the web/APK critical path',
  );

  section('.ci-build.sh is the only APK packager on the sidecar path');
  const ci = fs.readFileSync(path.join(ROOT, '.ci-build.sh'), 'utf8');
  assert.match(ci, /bash scripts\/package-apk\.sh/);
  const apkIdx = ci.indexOf('bash scripts/package-apk.sh');
  const aabGate = ci.indexOf('DV_BUILD_AAB:-0');
  const playGate = ci.indexOf('DV_PLAY_UPLOAD:-0');
  assert.ok(apkIdx > 0, 'CI calls package-apk.sh');
  assert.ok(aabGate > apkIdx, 'AAB is optional after APK');
  assert.ok(playGate > 0, 'Play upload gated on DV_PLAY_UPLOAD');

  section('PLAY-publish id + app_id=docvat → com.docvat + PLAY_STATUS completed');
  const play = loadWorkflow('deploy/PLAY-publish-v1.json');
  assert.strictEqual(play.id, 'PLAYPublishV1sc');
  const norm = String(nodeById(play, 'code-normalize').parameters.jsCode || '');
  assert.match(norm, /appId === 'docvat' \? 'com\.docvat'/);
  assert.match(
    norm,
    /status = body\.status \|\| \(appId === 'docvat' \? 'completed' : 'draft'\)/,
  );
  const uploadExpr = String(nodeById(play, 'run-upload').parameters.command || '');
  assert.match(uploadExpr, /\.json\.status \|\| 'completed'/);
  assert.match(uploadExpr, /PLAY_STATUS=\\?"\$STATUS\\?"/);

  section('PLAY-publish mounts DOCVAT_SECRETS_MOUNT; no host test -d of /home/deploy/secrets');
  assert.match(uploadExpr, /DOCVAT_SECRETS_MOUNT/);
  assert.match(uploadExpr, /\/home\/deploy\/secrets\/docvat:\/secrets:ro/);
  assert.match(
    uploadExpr,
    /never test -d those paths here/,
    'comment contract: n8n must not probe host secret dirs',
  );
  assert.ok(
    !/test -d \$\{SECRETS_MOUNT/.test(uploadExpr),
    'must not test -d ${SECRETS_MOUNT…} inside n8n',
  );
  assert.ok(
    !/test -d \/home\/deploy\/secrets/.test(uploadExpr),
    'must not test -d /home/deploy/secrets inside n8n (host path invisible)',
  );
  assert.ok(!uploadExpr.includes('SECRETS_MOUNT%%'));

  section('PLAY-publish packages AAB via package-aab.sh then play-upload-closed.js');
  assert.match(uploadExpr, /bash scripts\/package-aab\.sh/);
  assert.match(uploadExpr, /node \/work\/docvat\/scripts\/play-upload-closed\.js/);
  assert.ok(
    !/bundleRelease/.test(uploadExpr),
    'idle job must not call Gradle bundleRelease itself',
  );

  section('Play Telegram surfaces error.message + ::PLAY_ERROR:: (not only stdout)');
  const tgDone = String(nodeById(play, 'play-tg-done').parameters.text || '');
  assert.match(tgDone, /errObj\.message/);
  assert.match(tgDone, /PLAY_ERROR/);
  assert.match(tgDone, /targetSdk|API level/);

  section('package-apk.sh version injection (sidecar only runs this script)');
  const apkSh = fs.readFileSync(path.join(ROOT, 'scripts/package-apk.sh'), 'utf8');
  assert.ok(apkSh.includes('android-version.js'));
  assert.ok(apkSh.includes('-PdvVersionCode=${VERSION_CODE}'));
  assert.ok(apkSh.includes('-PdvVersionName=${VERSION_NAME}'));

  console.log('\nAll n8n-play structure tests passed.');
}

module.exports = { main };

if (require.main === module) {
  main();
}
