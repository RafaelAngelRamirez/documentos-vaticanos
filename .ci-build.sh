#!/usr/bin/env bash
# CI entrypoint for n8n sidecar (imperium-build-runner).
# Builds web + APK + Electron (Linux + Windows) + Docker image + deploys docvat.
#
# Layout note: n8n clones into /work/docvat (volume root is /work). When this
# file is used directly, set DV_CI_ROOT or run from the repo root.
set -euo pipefail

export HOME="${HOME:-/cache/gradle/.home_runner}"
mkdir -p "$HOME"

ROOT="${DV_CI_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  if [[ -f /work/docvat/package.json ]]; then
    ROOT=/work/docvat
  elif [[ -f /work/package.json ]]; then
    ROOT=/work
  else
    ROOT="$(cd "$(dirname "$0")" && pwd)"
  fi
fi

git config --global --add safe.directory "$ROOT" 2>/dev/null || true
git config --global user.name "Mr. Nochon" 2>/dev/null || true
git config --global user.email "mr.nochon@codice-progressio.online" 2>/dev/null || true

cd "$ROOT"

CURRENT_STAGE="iniciando"
# Optional progress webhook (no-op helper if missing)
if [[ -f "$ROOT/scripts/notify-build.sh" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/notify-build.sh"
  set -E
  trap 'notify_fail "$CURRENT_STAGE" 2>/dev/null || true' ERR
  notify_init "Documentos Vaticanos CI" 7 || true
else
  notify_step() { :; }
  notify_done() { :; }
  notify_fail() { :; }
  notify_init() { :; }
fi

# ---------------------------------------------------------------------------
# [1/7] Release FIRST (clean tree) so standard-version can commit + tag.
# Bump is persisted later by n8n "Artifact commit" + "Push" on /tmp/repo/docvat.
# Set DV_SKIP_RELEASE=1 only for emergency rebuilds without a version bump.
# ---------------------------------------------------------------------------
echo "==> [1/7] Release: standard-version (bump + CHANGELOG + tag, push via n8n)"
CURRENT_STAGE="Release (standard-version)"; notify_step "$CURRENT_STAGE" || true
if [[ "${DV_SKIP_RELEASE:-0}" != "1" ]]; then
  # Fail hard — swallowing errors left production stuck at 0.0.13.
  npx --yes standard-version@9.5.0
else
  echo "WARN: release skipped via DV_SKIP_RELEASE — version will NOT be bumped"
fi
VERSION="v$(node -p "require('./package.json').version")"
echo "::DOCVAT_VERSION::${VERSION}"
echo "==> release version ${VERSION} (HEAD $(git rev-parse --short HEAD 2>/dev/null || echo n/a))"

echo "==> [2/7] Dependencias (root + frontend + backend)"
CURRENT_STAGE="Dependencias"; notify_step "$CURRENT_STAGE" || true
if command -v yarn >/dev/null 2>&1; then
  yarn install --production=false || npm install --prefix . || true
else
  npm install || true
fi
( cd frontend && (yarn install --production=false || npm install) )
( cd backend && (yarn install --production=false || npm install) || true )

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
