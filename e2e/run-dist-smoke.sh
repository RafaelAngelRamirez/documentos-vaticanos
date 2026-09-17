#!/usr/bin/env bash
# Playwright reader smoke against a static SPA tree (dist/web).
# Usage: bash e2e/run-dist-smoke.sh [distDir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${1:-"$ROOT/dist/web"}"
E2E="$ROOT/e2e"
PORT="${E2E_PORT:-4173}"

if [[ ! -f "$DIST/index.html" ]]; then
  echo "ERROR: missing $DIST/index.html (run package-web first)" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "WARN: docker not found — skipping dist Playwright smoke" >&2
  exit 0
fi

echo "==> Playwright reader smoke against $DIST"
docker run --rm --network host \
  -e E2E_BASE_URL="http://127.0.0.1:${PORT}" \
  -e E2E_START_WEB= \
  -e CI=1 \
  -v "$DIST:/web:ro" \
  -v "$E2E:/e2e" \
  -w /e2e \
  mcr.microsoft.com/playwright:v1.49.1-jammy \
  bash -lc "npm install --omit=dev && npx --yes serve -s /web -l ${PORT} &
    for i in 1 2 3 4 5 6 7 8 9 10; do
      if curl -sf \"http://127.0.0.1:${PORT}/\" >/dev/null; then break; fi
      sleep 1
    done
    npx playwright test tests/app-reader.spec.ts --reporter=list"
