#!/usr/bin/env bash
# Playwright reader smoke against a static SPA tree (dist/web).
# Usage: bash e2e/run-dist-smoke.sh [distDir]
#
# Nested docker bind-mounts are host paths. Inside the CI sidecar, /work/docvat
# lives on volume codice-progressio_n8n_build — remount that volume, do not
# pass /work/... as a host bind (that was ENOENT /e2e/package.json).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${1:-"$ROOT/dist/web"}"
E2E="$ROOT/e2e"
PORT="${E2E_PORT:-4173}"
IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.49.1-jammy}"
VOLUME="${DV_BUILD_VOLUME:-codice-progressio_n8n_build}"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "ERROR: missing $DIST/index.html (run package-web first)" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "WARN: docker not found — skipping dist Playwright smoke" >&2
  exit 0
fi

INNER_WEB="/web"
INNER_E2E_SRC="/e2e-src"
DOCKER_ARGS=(--rm --ipc=host)

if [[ -d /work/docvat/e2e && -f /work/docvat/dist/web/index.html ]]; then
  echo "==> Playwright smoke via named volume $VOLUME (CI sidecar)"
  DOCKER_ARGS+=(-v "$VOLUME:/work")
  INNER_WEB="/work/docvat/dist/web"
  INNER_E2E_SRC="/work/docvat/e2e"
else
  echo "==> Playwright smoke via bind mounts (host)"
  DOCKER_ARGS+=(-v "$DIST:/web:ro" -v "$E2E:/e2e-src:ro")
fi

echo "==> Playwright reader smoke against $DIST"
docker run "${DOCKER_ARGS[@]}" \
  -e E2E_BASE_URL="http://127.0.0.1:${PORT}" \
  -e E2E_START_WEB= \
  -e CI=1 \
  -w /tmp/e2e \
  "$IMAGE" \
  bash -lc "set -euo pipefail
    cp -a ${INNER_E2E_SRC}/. /tmp/e2e/
    npm install
    node /tmp/e2e/spa-static.js ${INNER_WEB} ${PORT} &
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
      if curl -sf \"http://127.0.0.1:${PORT}/\" >/dev/null; then break; fi
      sleep 1
    done
    curl -sf \"http://127.0.0.1:${PORT}/\" >/dev/null
    curl -sf \"http://127.0.0.1:${PORT}/assets/corpus/manifest.json\" >/dev/null
    npx playwright test tests/app-reader.spec.ts --reporter=list"
