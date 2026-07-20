#!/usr/bin/env node
/**
 * Upload a signed AAB to Google Play closed testing (default track: alpha)
 * via the Android Publisher API.
 *
 * Env (secrets — never commit values):
 *   PLAY_PACKAGE_NAME          e.g. com.docvat or digital.documentosvaticanos.app
 *   PLAY_TRACK                 closed|alpha|… (default closed → alpha)
 *   PLAY_SERVICE_ACCOUNT_JSON  path to service-account JSON key
 *   PLAY_AAB_PATH              path to .aab (default dist/documentos-vaticanos-release.aab)
 *   PLAY_DRY_RUN=1             validate inputs + build payload only (no network)
 *   PLAY_STATUS                completed (default) | draft
 *
 * Exit codes:
 *   0 success / dry-run ok
 *   2 missing credentials or inputs (honest failure)
 *   3 API / network failure
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  versionFromSemver,
  normalizePlayTrack,
  buildTrackReleasePayload,
} = require('./android-version');

const ROOT = path.resolve(__dirname, '..');

function log(msg) {
  process.stdout.write(String(msg) + '\n');
}

function fail(code, msg) {
  process.stderr.write(String(msg) + '\n');
  process.exit(code);
}

function readMeta() {
  const metaPath = path.join(ROOT, 'dist/aab.meta.txt');
  if (!fs.existsSync(metaPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(metaPath, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

async function main() {
  const dryRun = process.env.PLAY_DRY_RUN === '1' || process.argv.includes('--dry-run');
  const packageName =
    process.env.PLAY_PACKAGE_NAME ||
    readMeta().packageName ||
    'digital.documentosvaticanos.app';
  const track = normalizePlayTrack(process.env.PLAY_TRACK || 'closed');
  const aabPath =
    process.env.PLAY_AAB_PATH ||
    path.join(ROOT, 'dist/documentos-vaticanos-release.aab');
  const saPath = process.env.PLAY_SERVICE_ACCOUNT_JSON || '';
  // Draft apps only accept status=draft until first production/closed rollout is published.
  const status = process.env.PLAY_STATUS || 'draft';
  const meta = readMeta();
  const versionCode = Number(meta.versionCode || process.env.PLAY_VERSION_CODE || 0);
  const versionName =
    meta.versionName ||
    process.env.PLAY_VERSION_NAME ||
    (() => {
      try {
        return versionFromSemver(require(path.join(ROOT, 'package.json')).version)
          .versionName;
      } catch {
        return '0.0.0';
      }
    })();

  log(`==> Play upload package=${packageName} track=${track} dryRun=${dryRun}`);
  log(`==> AAB path=${aabPath}`);

  if (!fs.existsSync(aabPath)) {
    fail(2, `ERROR: AAB missing at ${aabPath} — run scripts/package-aab.sh first`);
  }
  const aabStat = fs.statSync(aabPath);
  if (aabStat.size < 100000) {
    fail(2, `ERROR: AAB too small (${aabStat.size} bytes)`);
  }

  if (!versionCode || versionCode < 1) {
    fail(2, 'ERROR: versionCode missing (dist/aab.meta.txt or PLAY_VERSION_CODE)');
  }

  const trackBody = buildTrackReleasePayload({
    track,
    versionCodes: [versionCode],
    releaseName: versionName,
    status,
  });
  log(`==> track payload ${JSON.stringify(trackBody)}`);

  if (!saPath || !fs.existsSync(saPath)) {
    const msg =
      'ERROR: PLAY_SERVICE_ACCOUNT_JSON missing or not a file. ' +
      'Link a service account under Play Console → Users and permissions / API access, ' +
      'then set PLAY_SERVICE_ACCOUNT_JSON to the JSON key path (never commit the key).';
    if (dryRun) {
      log(`DRY_RUN: would fail without credentials: ${msg}`);
      log(
        JSON.stringify({
          dryRun: true,
          packageName,
          track,
          aabPath,
          aabBytes: aabStat.size,
          versionCode,
          versionName,
          trackBody,
          credentials: 'missing',
        })
      );
      process.exit(0);
    }
    fail(2, msg);
  }

  if (dryRun) {
    log(
      JSON.stringify({
        dryRun: true,
        packageName,
        track,
        aabPath,
        aabBytes: aabStat.size,
        versionCode,
        versionName,
        trackBody,
        credentials: 'present',
        saPath: path.basename(saPath),
      })
    );
    process.exit(0);
  }

  // Lazy-require googleapis so unit/dry-run works without the dep installed.
  let google;
  try {
    google = require('googleapis').google;
  } catch {
    try {
      google = require(path.join(ROOT, 'node_modules/googleapis')).google;
    } catch {
      fail(
        2,
        'ERROR: googleapis package not installed. Run: npm install googleapis --no-save (CI) or add as optional dep'
      );
    }
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: saPath,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const androidpublisher = google.androidpublisher({ version: 'v3', auth });

  log('==> edits.insert');
  const editRes = await androidpublisher.edits.insert({ packageName });
  const editId = editRes.data.id;
  if (!editId) fail(3, 'ERROR: edits.insert returned no edit id');
  log(`==> editId=${editId}`);

  log('==> bundles.upload');
  const media = {
    mimeType: 'application/octet-stream',
    body: fs.createReadStream(aabPath),
  };
  let uploadRes;
  try {
    uploadRes = await androidpublisher.edits.bundles.upload({
      packageName,
      editId,
      media,
    });
  } catch (err) {
    const statusCode = err?.code || err?.response?.status;
    const data = err?.response?.data || err?.message;
    log(`ERROR bundles.upload status=${statusCode} body=${JSON.stringify(data)}`);
    // best-effort delete edit
    try {
      await androidpublisher.edits.delete({ packageName, editId });
    } catch {
      /* ignore */
    }
    process.exit(3);
  }
  const uploadedVersionCode = uploadRes.data.versionCode;
  log(`==> uploaded versionCode=${uploadedVersionCode}`);

  const assignBody = buildTrackReleasePayload({
    track,
    versionCodes: [Number(uploadedVersionCode || versionCode)],
    releaseName: versionName,
    status,
  });
  log(`==> tracks.update ${JSON.stringify(assignBody)}`);
  await androidpublisher.edits.tracks.update({
    packageName,
    editId,
    track: assignBody.track,
    requestBody: assignBody,
  });

  log('==> edits.commit');
  const commitRes = await androidpublisher.edits.commit({ packageName, editId });
  log(
    JSON.stringify({
      ok: true,
      packageName,
      track: assignBody.track,
      editId,
      versionCode: uploadedVersionCode,
      versionName,
      commit: commitRes.data,
    })
  );
}

main().catch((err) => {
  const statusCode = err?.code || err?.response?.status;
  const data = err?.response?.data || err?.message || String(err);
  process.stderr.write(
    `ERROR play-upload-closed: status=${statusCode} ${JSON.stringify(data)}\n`
  );
  process.exit(3);
});
