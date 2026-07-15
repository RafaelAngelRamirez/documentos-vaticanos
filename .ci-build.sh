#!/usr/bin/env bash
# CI entrypoint for n8n sidecar (imperium-build-runner).
# Builds web + APK + Electron (Linux + Windows) + Docker image + deploys docvat.
set -euo pipefail

export HOME="${HOME:-/cache/gradle/.home_runner}"
mkdir -p "$HOME"
git config --global --add safe.directory /work 2>/dev/null || true
git config --global user.name "Mr. Nochon" 2>/dev/null || true
git config --global user.email "mr.nochon@codice-progressio.online" 2>/dev/null || true

cd /work

CURRENT_STAGE="iniciando"
# Optional progress webhook (no-op helper if missing)
if [[ -f /work/scripts/notify-build.sh ]]; then
  # shellcheck disable=SC1091
  source /work/scripts/notify-build.sh
  set -E
  trap 'notify_fail "$CURRENT_STAGE" 2>/dev/null || true' ERR
  notify_init "Documentos Vaticanos CI" 7 || true
else
  notify_step() { :; }
  notify_done() { :; }
  notify_fail() { :; }
  notify_init() { :; }
fi

echo "==> [1/7] Dependencias (root + frontend + backend)"
CURRENT_STAGE="Dependencias"; notify_step "$CURRENT_STAGE" || true
if command -v yarn >/dev/null 2>&1; then
  yarn install --production=false || npm install --prefix . || true
else
  npm install || true
fi
( cd frontend && (yarn install --production=false || npm install) )
( cd backend && (yarn install --production=false || npm install) || true )

echo "==> [2/7] Release: standard-version (bump + CHANGELOG + tag, SIN push)"
CURRENT_STAGE="Release (standard-version)"; notify_step "$CURRENT_STAGE" || true
if [[ "${DV_SKIP_RELEASE:-0}" != "1" ]]; then
  if command -v yarn >/dev/null 2>&1; then
    yarn standard-version || npx standard-version
  else
    npx standard-version
  fi
fi
VERSION="v$(node -p "require('./package.json').version")"
echo "::DOCVAT_VERSION::${VERSION}"

echo "==> [3/7] Web production + corpus"
CURRENT_STAGE="Web production"; notify_step "$CURRENT_STAGE" || true
bash scripts/package-web.sh

echo "==> [4/7] APK instalable"
CURRENT_STAGE="APK instalable"; notify_step "$CURRENT_STAGE" || true
bash scripts/package-apk.sh

echo "==> [5/7] Electron Linux + Windows"
CURRENT_STAGE="Electron linux+win"; notify_step "$CURRENT_STAGE" || true
# CI requires both platforms when Wine is present
export DV_ELECTRON_TARGETS="${DV_ELECTRON_TARGETS:-linux,win}"
export DV_REQUIRE_WIN="${DV_REQUIRE_WIN:-1}"
bash scripts/package-electron.sh

echo "==> [6/7] Collect downloads into web tree"
CURRENT_STAGE="Collect downloads"; notify_step "$CURRENT_STAGE" || true
export DV_REQUIRE_ALL_DOWNLOADS="${DV_REQUIRE_ALL_DOWNLOADS:-1}"
bash scripts/package-collect-downloads.sh

echo "==> [7/7] Docker image + push + deploy docvat"
CURRENT_STAGE="Docker + deploy"; notify_step "$CURRENT_STAGE" || true
# Ensure frontend dist has downloads (collect already copied)
if [[ ! -d frontend/dist/documentos-vaticanos/downloads ]]; then
  echo "ERROR: downloads missing under frontend dist" >&2
  exit 1
fi

# docker-compilar expects to rebuild; we already built — use a CI-friendly path
bash scripts/ci-docker-push.sh

# Deploy / recreate the docvat container on the host network
bash scripts/ci-deploy-docvat.sh

notify_done || true
echo "::DOCVAT_BUILD_DONE::${VERSION}"
