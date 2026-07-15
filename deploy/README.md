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
  - GitHub push on `RafaelAngelRamirez/documentos-vaticanos` (branches `master`, `typescript-migration`), filtered to non-`chore(release)` commits (same pattern as Imperium)
  - Manual webhook `POST /webhook/docvat-build` with body `{ "branch": "master" }`
- Runner: `imperium-build-runner:latest` (glibc sidecar) with volumes:
  - `codice-progressio_n8n_build`, `_android_sdk`, `_gradle`, `_electron`
- Entry: `.ci-build.sh` → package web/apk/electron → collect downloads → `ci-docker-push.sh` → `ci-deploy-docvat.sh`

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
npm run test:downloads       # structural gates for download paths
npm run test:electron-paths  # electron static server gates
```

Windows build uses Wine + `signAndEditExecutable=false` (portable target by default).
Set `DV_REQUIRE_WIN=1` and `DV_REQUIRE_ALL_DOWNLOADS=1` in CI.
