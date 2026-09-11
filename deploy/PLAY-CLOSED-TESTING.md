# Google Play · Closed testing (Documentos Vaticanos)

One-time Console setup was done with **Playwright against the logged-in Chrome session** (`rafa.yael@gmail.com` → developer account **Codice Progressio**). Ongoing updates are **API + n8n**, not browser scraping.

## Console facts

| Field | Value |
|-------|--------|
| Google account | `rafa.yael@gmail.com` |
| Developer account | Codice Progressio |
| Developer ID | `4804831450172281943` |
| App name | Documentos Vaticanos |
| App ID (Console) | `4972348861079915632` |
| **Package name (Play)** | **`com.docvat`** |
| Closed tracks | default **Alpha** + custom **`closed`** (`tracks/4699966716943845821`) |
| API track id for uploads | `alpha` (Play maps default closed testing to `alpha`; env `PLAY_TRACK=closed` normalizes to `alpha`) |
| Capacitor / default `applicationId` in source | `digital.documentosvaticanos.app` |
| CI package override for Play | `DV_PACKAGE_NAME=com.docvat` (must match Console) |

> Package mismatch note: the monorepo Capacitor id is still `digital.documentosvaticanos.app` (sideload APK). Play drafts use **`com.docvat`**. `package-aab.sh` accepts `DV_PACKAGE_NAME` so the signed AAB matches Console without renaming Java packages.

Playwright was used **only for initial Console setup**. Do not drive every release through the browser.

## Local / CI secrets (names only — never commit values)

| Env var | Purpose |
|---------|---------|
| `DV_KEYSTORE_PATH` | Path to upload keystore (`.jks` / `.keystore`) |
| `DV_KEYSTORE_PASSWORD` | Keystore password |
| `DV_KEY_ALIAS` | Key alias (default `docvat-upload`) |
| `DV_KEY_PASSWORD` | Key password (defaults to store password) |
| `DV_PACKAGE_NAME` | Play `applicationId` override (`com.docvat`) |
| `DV_BUILD_AAB=1` | Force AAB step in `.ci-build.sh` |
| `DV_PLAY_UPLOAD=1` | After deploy, run Play closed upload |
| `PLAY_SERVICE_ACCOUNT_JSON` | Path to Google Cloud **service account** JSON key with Play Android Publisher access |
| `PLAY_PACKAGE_NAME` | Defaults to `com.docvat` |
| `PLAY_TRACK` | `closed` → API track `alpha` |
| `PLAY_AAB_PATH` | Defaults to `dist/documentos-vaticanos-release.aab` |
| `PLAY_DRY_RUN=1` | Validate payload without calling Google |
| `PLAY_STATUS` | **`completed`** once closed testing is live (testers get the release). Use `draft` only while the Console app is still **Borrador**. Host default was historically `draft` — change to `completed` after the first successful closed release (Documentos Vaticanos / `com.docvat` already ships closed Alpha). |

Suggested host paths (outside git):

```text
~/.config/documentos-vaticanos/docvat-upload.jks
~/.config/documentos-vaticanos/play-service-account.json
```

On the n8n / `imperium-build-runner` host, mount the same files and pass the env vars into the Build sidecar `docker run`.

## Packaging

```bash
# Signed AAB → dist/documentos-vaticanos-release.aab + dist/aab.meta.txt
export DV_KEYSTORE_PATH=…
export DV_KEYSTORE_PASSWORD=…
export DV_PACKAGE_NAME=com.docvat
npm run package:aab

# Upload to closed track (API)
export PLAY_SERVICE_ACCOUNT_JSON=…
export PLAY_PACKAGE_NAME=com.docvat
export PLAY_TRACK=closed
npm run play:upload-closed
```

Helpers:

- `scripts/android-version.js` — semver → `versionCode` / `versionName`
- `scripts/package-aab.sh` — Cap sync + `bundleRelease` with signing props
- `scripts/play-upload-closed.js` — edits.insert → bundles.upload → tracks.update → commit

Unit tests: `npm run test:android-version`.

## Service account (Play API)

1. Google Cloud project linked to Play Console (**Setup → API access**).
2. Create a service account; download JSON key → store only on the build host.
3. In Play Console **Users and permissions**, invite the service account email with rights to **Release to testing tracks** (and View app information).
4. Accept the invite / grant access (can take minutes to propagate).

Without `PLAY_SERVICE_ACCOUNT_JSON`, `play-upload-closed.js` exits **2** with an explicit message (honest failure). Dry-run with `PLAY_DRY_RUN=1` still validates AAB + payload when the artifact exists.

### Dependency: `googleapis`

`scripts/play-upload-closed.js` uses the Google APIs Node client (`googleapis`). It is a **root** `package.json` dependency so `yarn install` / `npm install` in `.ci-build.sh` step `[2/7]` pulls it into the runner. If it is still missing at upload time, `.ci-build.sh` installs `googleapis@^144` with `npm install --no-save` before calling the script.

**Root cause (2026-07):** builds with `DV_PLAY_UPLOAD=1` finished web/APK/docker then failed at Play with `ERROR: googleapis package not installed`, so n8n marked the whole job error and no new versionCode appeared after `0.0.20` on the Alpha track.

**Root cause (2026-08-19):** the idle job `PLAY-publish v1` (`PLAYPublishV1sc`) packaged Docvat AAB against **IMPERIUM** secrets. n8n env `PLAY_SECRETS_MOUNT` points at `/home/deploy/secrets/imperium`, and the node also did `test -d` of that host path **inside** the n8n container (where `/home/deploy/secrets` is not mounted), so it always fell back to Imperium. Log: `ERROR: release keystore not found at /secrets/docvat-upload.jks`. Telegram still said “Play listo” because the node has `continueOnFail` (mutex must release). Fix: mount `DOCVAT_SECRETS_MOUNT` (`/home/deploy/secrets/docvat`) when `app_id=docvat`; never `test -d` host secret paths from n8n. Snapshot: `deploy/PLAY-publish-v1.json`. Git push does **not** update the live n8n graph — re-import that file.

**Root cause (2026-08-21):** after the secrets mount was fixed, Play packaged AAB from a **clean clone** (no `frontend/node_modules`). `package-aab.sh` ran `npm run build` → `sh: 1: ng: not found` (exit 127). Fix: `package-aab.sh` installs frontend deps when `frontend/node_modules/.bin/ng` is missing.

## n8n (DOCVAT-build)

Workflow: `deploy/DOCVAT-build-v1-sidecar.json` · id `DOCVATBuildV1sc`.

The repo `.ci-build.sh` already contains optional AAB + upload steps. Wire secrets on the **Build sidecar** `docker run` (same place as `DOCKER_TOKEN`):

```bash
-e DV_BUILD_AAB=1 \
-e DV_PLAY_UPLOAD=1 \
-e DV_PACKAGE_NAME=com.docvat \
-e DV_KEYSTORE_PATH=/secrets/docvat-upload.jks \
-e DV_KEYSTORE_PASSWORD=… \
-e DV_KEY_ALIAS=docvat-upload \
-e DV_KEY_PASSWORD=… \
-e PLAY_SERVICE_ACCOUNT_JSON=/secrets/play-service-account.json \
-e PLAY_PACKAGE_NAME=com.docvat \
-e PLAY_TRACK=closed \
-e PLAY_STATUS=completed \
-v /path/on/host/secrets:/secrets:ro \
```

Ordering inside `.ci-build.sh` (do not reorder): release → deps → web → APK → **AAB** → Electron → collect downloads → docker push/deploy → **Play upload last**.

Host checklist when testers do not see updates:

1. Last **PLAY-publish** execution log contains `::PLAY_PUBLISH_DONE::com.docvat` (or `::DOCVAT_PLAY_UPLOAD_OK::`). Sidecar web (`DOCVAT-build`) is expected to skip Play (`DV_PLAY_UPLOAD=0`) and enqueue this idle job. Failures: `release keystore not found at /secrets/docvat-upload.jks` (wrong secrets mount) or `googleapis package not installed`.
2. `PLAY_STATUS=completed` on the n8n container (not stuck on `draft` after the app left Borrador).
3. New `versionCode` / `versionName` higher than the active Alpha release (Console → Versiones y paquetes).
4. Closed track **Alpha** (API `alpha`); custom track `closed` is optional and currently unused by CI.
5. Target API level / policy notifications in Console must not block the release.

Optional sibling: after a successful build, n8n can run only:

```bash
node scripts/play-upload-closed.js
```

inside the runner with the AAB from `/work/docvat/dist/`.

### Re-import / activate workflow

```bash
scp deploy/DOCVAT-build-v1-sidecar.json codice-progressio:/tmp/
ssh codice-progressio '
  docker cp /tmp/DOCVAT-build-v1-sidecar.json n8n:/tmp/ &&
  docker exec n8n n8n import:workflow --input=/tmp/DOCVAT-build-v1-sidecar.json &&
  docker exec n8n n8n update:workflow --id=DOCVATBuildV1sc --active=true
  cd /root/codice-progressio && sudo docker compose restart n8n
'
```

Play idle job (AAB + upload; does not wipe the shared volume):

```bash
scp deploy/PLAY-publish-v1.json codice-progressio:/tmp/
ssh codice-progressio '
  docker cp /tmp/PLAY-publish-v1.json n8n:/tmp/ &&
  docker exec n8n n8n import:workflow --input=/tmp/PLAY-publish-v1.json &&
  docker exec n8n n8n update:workflow --id=PLAYPublishV1sc --active=true
'
# trigger Docvat closed track
ssh codice-progressio 'docker exec n8n wget -qO- --post-data="{\"app_id\":\"docvat\"}" \
  --header="Content-Type: application/json" http://127.0.0.1:5678/webhook/play-publish'
```

Git push alone does **not** update the live n8n graph.

## Android developer verification (deadline 2026-09-30)

Play Console → **Verificación de desarrolladores de Android**:
`https://play.google.com/console/u/0/developers/4804831450172281943/android-developer-verification`

Identity (RAMIREZ ESTRADA RAFAEL ANGEL) is already verified. Play packages already **Registrada**:

| Package | Notes |
|---------|--------|
| `com.docvat` | Documentos Vaticanos (Play App Signing) |
| `com.codiceprogressio.imperiumsic` | IMPERIUMsic |
| `mx.parroquia.gestion` | Gestión Parroquial |

Off-Play sideload / Capacitor id **`digital.documentosvaticanos.app`** was submitted 2026-09-11 with the host `androiddebugkey` SHA-256 (`4F:09:11:3D:…:E9:43`). Console status after APK proof upload: **En revisión** (Google may take up to 48h).

Proof APK must contain `assets/adi-registration.properties` with the Console snippet and be signed with the same private key as the registered fingerprint. The debug APK on the phone uses this package + debug cert, not `com.docvat`.

## Manual Console URLs

- App list: `https://play.google.com/console/u/0/developers/4804831450172281943/app-list`
- Closed testing: `…/app/4972348861079915632/closed-testing`
- Track `closed`: `…/app/4972348861079915632/tracks/4699966716943845821`
- Developer verification: `…/android-developer-verification`

## Out of scope

- Production / open testing launch
- Completing Google’s 12 testers × 14 days production eligibility clock
- Replacing sideload APK on docvat `/downloads/`
