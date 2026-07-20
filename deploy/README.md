# Deploy · Documentos Vaticanos (`docvat`)

Public site: **https://docvat.codice-progressio.online/**

## What CI builds

| Artifact | Public path |
|----------|-------------|
| Web SPA + corpus | `/` |
| Android APK | `/downloads/documentos-vaticanos.apk` |
| Electron Linux | `/downloads/documentos-vaticanos-linux.AppImage` |
| Electron Windows (portable) | `/downloads/documentos-vaticanos-windows.exe` |
| Manifest | `/downloads/manifest.json` |

UI links live under **Acerca de** (`/about`).

## n8n workflow

- Export: `DOCVAT-build-v1-sidecar.json` (also in `codice-progressio-odoo-server/n8n-workflows/`)
- Workflow id: `DOCVATBuildV1sc`
- Name: `DOCVAT-build v1 (sidecar)`
- Triggers:
  - GitHub push on `RafaelAngelRamirez/documentos-vaticanos` (branches `master`, `typescript-migration`)
  - Manual webhook `POST /webhook/docvat-build` with body `{ "branch": "typescript-migration" }`
- **Skip-CI (no build)** when the push commit message(s) match any of:
  - `chore(release)` — avoids loop after `standard-version` push
  - `multi-locale twins progress` / `auto multi-locale twins` — corpus twin goal auto-commit bots  
  Implemented in node **Nombre de la rama** (`skip_ci_flag`) + IF **No es commit de skip-CI**.
- Runner: `imperium-build-runner:latest` (glibc sidecar) with volumes:
  - `codice-progressio_n8n_build`, `_android_sdk`, `_gradle`, `_electron`
- Entry: clone → run **repo** `.ci-build.sh` in `imperium-build-runner` → package web/apk/electron → collect downloads → `ci-docker-push.sh` → `ci-deploy-docvat.sh` → n8n “Artifact commit” + push from `/tmp/repo/docvat`

### CI runner image (do not lose)

The n8n sidecar runs builds inside **`imperium-build-runner:latest`**. That image is **not** part of a long-running compose service for the build itself (`docker run --rm`), so a plain `docker system prune --force --all` (formerly in Imperium `update.sh`) **deletes it** and every DOCVAT/IMPERIUM build then fails after the Telegram “started” message with `ERROR: imperium-build-runner:latest missing`.

Hardening on the host (`codice-progressio`):

| Layer | What |
|-------|------|
| **Pin container** | `imperium-build-runner-pin` (`sleep infinity`, `restart: unless-stopped`) so prune `--all` still sees the image as in use. Owned by compose service of the same name in `/root/codice-progressio/compose.yml`. |
| **Registry mirror** | `legna37/imperium-build-runner:latest` on Docker Hub (same digest as local). |
| **update.sh** | Imperium update no longer runs `prune --all`; dangling-only prune + restore-from-Hub if missing. |
| **Workflow** | Build sidecar auto-pulls/tags from Hub and re-pins if the local image is gone. |

Rebuild / restore on the server:

```bash
# rebuild from Dockerfile
cd /root/codice-progressio
docker build -t imperium-build-runner:latest -t legna37/imperium-build-runner:latest build-runner/
docker push legna37/imperium-build-runner:latest
docker compose up -d imperium-build-runner-pin

# or restore only
docker pull legna37/imperium-build-runner:latest
docker tag legna37/imperium-build-runner:latest imperium-build-runner:latest
docker start imperium-build-runner-pin \
  || docker run -d --name imperium-build-runner-pin --restart unless-stopped \
       imperium-build-runner:latest sleep infinity
```
- **Versioning (important):**
  1. Sidecar clones the branch with tags + ~300 commits of history (for `standard-version`).
  2. `.ci-build.sh` runs **`standard-version` before `yarn install`** (clean tree), bumps `package.json` / `frontend/package.json` / `environment*.ts` / `CHANGELOG` / `easy_version`, commits + tags `vX.Y.Z`.
  3. Build/deploy use that version (`/downloads/manifest.json`, UI `environment.version`).
  4. n8n pushes the release commit + tag back to GitHub. Messages containing `chore(release)` are ignored by the trigger (no loop).
  5. Emergency rebuild without bump: host/n8n env `DV_SKIP_RELEASE=1` (default **0**).
- **Lock:** `/tmp/docvat-build.lock` inside the `n8n` container. Concurrent runs **wait** up to `DOCVAT_LOCK_WAIT_SEC` (default **7200** s) by polling `flock -n` (BusyBox-compatible; n8n Alpine has no util-linux `flock -w`) instead of failing immediately with “another DOCVAT build holds…”. Only one clone/build mutates the shared volume at a time.
- **Disk (ENOSPC):** full DOCVAT builds peak multi‑GB (web corpus + APK + Electron). `.ci-build.sh` aborts early if free space on the work path is below `DV_MIN_FREE_GB` (default **12**). Collect uses hardlinks when possible; electron drops `*-unpacked` after packaging; `ci-docker-push.sh` keeps only `DV_IMAGE_KEEP` (default **2**) local `front-v*` tags plus `front-latest`.

Host cleanup when builds fail with `No space left on device` (keep the runner pin):

```bash
docker builder prune -af
docker image prune -af   # does not remove images used by running containers / pin
# optional: wipe shared build volume when no active runner (not the pin)
docker run --rm -v codice-progressio_n8n_build:/v alpine \
  sh -c 'rm -rf /v/* /v/.[!.]* /v/..?* 2>/dev/null; du -sh /v'
df -h /
```

Do **not** use `docker system prune --all` without `imperium-build-runner-pin` (see above).

### After changing this workflow JSON

**Re-import into the live n8n** (git push alone does not update the workflow). Until then, production keeps the old graph with hard-coded release skip (`DV_SKIP_RELEASE=1` → stuck at `0.0.13`). See “Import / activate” below.

### Import / activate

```bash
scp deploy/DOCVAT-build-v1-sidecar.json codice-progressio:/tmp/
ssh codice-progressio '
  docker cp /tmp/DOCVAT-build-v1-sidecar.json n8n:/tmp/ &&
  docker exec n8n n8n import:workflow --input=/tmp/DOCVAT-build-v1-sidecar.json &&
  docker exec n8n n8n update:workflow --id=DOCVATBuildV1sc --active=true
  cd /root/codice-progressio && sudo docker compose restart n8n
'
```

Manual trigger (internal, avoids Cloudflare hairpin):

```bash
ssh codice-progressio 'docker exec n8n curl -s -X POST http://localhost:5678/webhook/docvat-build \
  -H "Content-Type: application/json" -d "{\"branch\":\"master\"}"'
```

## DNS

Cloudflare zone `codice-progressio.online`:

- **A** `docvat` → `185.209.229.231` (proxied)
- Token path (ops only, not in git secrets):  
  `/home/angel/proyectos/codice-progressio/codice-progressio-odoo-server/cloudflare.token`

## Manual deploy (without full n8n build)

```bash
# after local package:all + docker image push
ssh codice-progressio 'bash -s' <<'REMOTE'
IMAGE=legna37/documentos-vaticanos:front-latest
docker pull "$IMAGE"
docker rm -f docvat-web 2>/dev/null || true
docker run -d --name docvat-web --restart unless-stopped \
  --network codice-progressio_default \
  -e VIRTUAL_HOST=docvat.codice-progressio.online \
  -e VIRTUAL_PORT=80 \
  -e LETSENCRYPT_HOST=docvat.codice-progressio.online \
  -e LETSENCRYPT_EMAIL=rafa.yael@gmail.com \
  "$IMAGE"
REMOTE
```

Compose fragment: `compose.docvat.yml` (external network `codice-progressio_default`).

## Local packaging

```bash
npm run package:all          # web + apk + electron linux/win + collect downloads
npm run package:aab          # signed Play App Bundle (needs DV_KEYSTORE_* env)
npm run play:upload-closed   # upload AAB to Play closed track (API; needs service account)
npm run test:downloads       # structural gates for download paths
npm run test:electron-paths  # electron static server gates
npm run test:android-version # versionCode / track payload helpers
```

Windows build uses Wine + `signAndEditExecutable=false` (portable target by default).
Set `DV_REQUIRE_WIN=1` and `DV_REQUIRE_ALL_DOWNLOADS=1` in CI.

## Google Play closed testing

See **`deploy/PLAY-CLOSED-TESTING.md`** for:

- Console package `com.docvat`, closed track / API track `alpha`
- Secret **names** (`DV_KEYSTORE_*`, `PLAY_SERVICE_ACCOUNT_JSON`, `DV_PLAY_UPLOAD`, …)
- How Playwright was used only for **initial** Console setup (`rafa.yael@gmail.com`)
- How n8n re-import activates workflow changes after editing `DOCVAT-build-v1-sidecar.json`

Enable on the host/n8n Build sidecar with `DV_BUILD_AAB=1` + `DV_PLAY_UPLOAD=1` and mounted keystore + service-account JSON (never commit those files).
