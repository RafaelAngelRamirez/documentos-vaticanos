#!/usr/bin/env bash
# CI entrypoint for n8n sidecar (imperium-build-runner).
# Critical path is mobile-first: web + APK + Docker deploy.
# Electron (esp. Windows/Wine) is OFF by default — opt in with DV_BUILD_ELECTRON=1.
#
# Layout note: n8n clones into /work/docvat (volume root is /work). When this
# file is used directly, set DV_CI_ROOT or run from the repo root.
set -euo pipefail

export HOME="${HOME:-/cache/gradle/.home_runner}"
mkdir -p "$HOME"

# Shared caches (n8n mounts these when present)
export YARN_CACHE_FOLDER="${YARN_CACHE_FOLDER:-/cache/yarn}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/cache/gradle}"
export ELECTRON_CACHE="${ELECTRON_CACHE:-/cache/electron/electron}"
export ELECTRON_BUILDER_CACHE="${ELECTRON_BUILDER_CACHE:-/cache/electron/electron-builder}"
export DOCKER_BUILDX_CACHE="${DOCKER_BUILDX_CACHE:-/cache/buildx}"
export BUILD_NOTIFY_HEARTBEAT="${BUILD_NOTIFY_HEARTBEAT:-15}"
mkdir -p "$YARN_CACHE_FOLDER" "$GRADLE_USER_HOME" \
  "$ELECTRON_CACHE" "$ELECTRON_BUILDER_CACHE" \
  "${DOCKER_BUILDX_CACHE}" 2>/dev/null || true

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
# Progress bar via BUILD-progress webhook (same as IMPERIUM). No-op if helper missing.
if [[ -f "$ROOT/scripts/notify-build.sh" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/notify-build.sh"
  set -E
  trap 'ec=$?; notify_fail "${CURRENT_STAGE:-build}" "exit ${ec} · ${BASH_COMMAND}" 2>/dev/null || true' ERR
else
  notify_step() { :; }
  notify_done() { :; }
  notify_fail() { :; }
  notify_init() { :; }
  notify_exec() { "$@"; }
  notify_stage_log() { printf '%s' "/dev/null"; }
fi

# Stages on the critical path (mobile-first). Electron is optional and not counted
# unless DV_BUILD_ELECTRON=1 (then total becomes 8).
_STAGES=7
if [[ "${DV_BUILD_ELECTRON:-0}" == "1" ]]; then
  _STAGES=8
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo typescript-migration)"
notify_init "Documentos Vaticanos CI" "$_STAGES" "${BRANCH}" || true

# ---------------------------------------------------------------------------
# Disk preflight — APK+web peak needs free space on the shared volume/host.
# Override: DV_MIN_FREE_GB=0 to skip; default 10 GiB (was 12 with Electron+Win).
# ---------------------------------------------------------------------------
assert_disk_space() {
  local min_gb="${DV_MIN_FREE_GB:-10}"
  if [[ "$min_gb" == "0" ]]; then
    echo "==> disk preflight skipped (DV_MIN_FREE_GB=0)"
    return 0
  fi
  local path="${1:-$ROOT}"
  local avail_kb avail_gb
  avail_kb=$(df -Pk "$path" 2>/dev/null | awk 'NR==2 {print $4}')
  if [[ -z "${avail_kb:-}" || ! "$avail_kb" =~ ^[0-9]+$ ]]; then
    echo "WARN: could not read free space for $path — continuing" >&2
    return 0
  fi
  avail_gb=$((avail_kb / 1024 / 1024))
  echo "==> disk free on $path: ${avail_gb}G (min ${min_gb}G)"
  df -h "$path" || true
  if (( avail_gb < min_gb )); then
    echo "ERROR: only ${avail_gb}G free on $path (need ≥ ${min_gb}G)." >&2
    echo "ERROR: free Docker images/cache on the host, then re-run." >&2
    echo "ERROR: hint: docker builder prune -af && docker image prune -af" >&2
    echo "ERROR: keep imperium-build-runner-pin; do not prune --all without pin." >&2
    return 1
  fi
}

echo "==> [1/${_STAGES}] Disk preflight"
CURRENT_STAGE="Disk preflight"
notify_step "$CURRENT_STAGE" || true
assert_disk_space "$ROOT"

# ---------------------------------------------------------------------------
# Release FIRST (clean tree) so standard-version can commit + tag.
# Bump is persisted later by n8n "Artifact commit" + "Push" on /tmp/repo/docvat.
# Set DV_SKIP_RELEASE=1 only for emergency rebuilds without a version bump.
# ---------------------------------------------------------------------------
echo "==> [2/${_STAGES}] Release: standard-version (bump + CHANGELOG + tag, push via n8n)"
CURRENT_STAGE="Release (standard-version)"
notify_step "$CURRENT_STAGE" || true
if [[ "${DV_SKIP_RELEASE:-0}" != "1" ]]; then
  # Fail hard — swallowing errors left production stuck at 0.0.13.
  npx --yes standard-version@9.5.0
else
  echo "WARN: release skipped via DV_SKIP_RELEASE — version will NOT be bumped"
fi
VERSION="v$(node -p "require('./package.json').version")"
echo "::DOCVAT_VERSION::${VERSION}"
echo "==> release version ${VERSION} (HEAD $(git rev-parse --short HEAD 2>/dev/null || echo n/a))"
if [[ -n "${BUILD_RUN_ID:-}" && -d "/tmp/build-notify-${BUILD_RUN_ID}.d" ]]; then
  printf '%s' "${BRANCH} · ${VERSION}" > "/tmp/build-notify-${BUILD_RUN_ID}.d/subtitle" 2>/dev/null || true
fi

echo "==> [3/${_STAGES}] Dependencias (root + frontend + backend) [YARN_CACHE_FOLDER=$YARN_CACHE_FOLDER]"
CURRENT_STAGE="Dependencias"
notify_step "$CURRENT_STAGE" || true
yarn_install() {
  local dir="${1:-.}"
  if [[ "$dir" == "." ]]; then
    if command -v yarn >/dev/null 2>&1; then
      yarn install --production=false --prefer-offline || yarn install --production=false
    else
      npm install
    fi
  else
    (
      cd "$dir"
      if command -v yarn >/dev/null 2>&1; then
        yarn install --production=false --prefer-offline || yarn install --production=false
      else
        npm install
      fi
    )
  fi
}
yarn_install .
yarn_install frontend
yarn_install backend || true

echo "==> [4/${_STAGES}] Web production + corpus"
CURRENT_STAGE="Web production"
notify_step "$CURRENT_STAGE" || true
bash scripts/package-web.sh

# Mobile-first: APK is the product priority (before Electron / desktop).
echo "==> [5/${_STAGES}] APK instalable (mobile-first)"
CURRENT_STAGE="APK instalable"
notify_step "$CURRENT_STAGE" || true
bash scripts/package-apk.sh

# Optional AAB (Play) — not on the default critical path unless keystore/env set.
if [[ "${DV_BUILD_AAB:-0}" == "1" || "${DV_PLAY_UPLOAD:-0}" == "1" || -n "${DV_KEYSTORE_PASSWORD:-}" ]]; then
  CURRENT_STAGE="AAB signed"
  notify_step "$CURRENT_STAGE" || true
  if [[ -z "${DV_KEYSTORE_PASSWORD:-}" ]]; then
    echo "WARN: skipping AAB — set DV_KEYSTORE_PATH + DV_KEYSTORE_PASSWORD"
  else
    export DV_PACKAGE_NAME="${DV_PACKAGE_NAME:-com.docvat}"
    bash scripts/package-aab.sh
  fi
else
  echo "==> AAB skipped (set DV_BUILD_AAB=1 or DV_PLAY_UPLOAD=1 or DV_KEYSTORE_PASSWORD)"
fi

# Electron is expensive (Wine for Windows). Default OFF on CI critical path.
# Opt in: DV_BUILD_ELECTRON=1. Windows still off unless DV_REQUIRE_WIN=1 or
# DV_ELECTRON_TARGETS includes win.
if [[ "${DV_BUILD_ELECTRON:-0}" == "1" ]]; then
  echo "==> [6/${_STAGES}] Electron (opt-in DV_BUILD_ELECTRON=1)"
  CURRENT_STAGE="Electron"
  notify_step "$CURRENT_STAGE" || true
  # Default linux-only when building electron in CI; Win requires explicit targets.
  export DV_ELECTRON_TARGETS="${DV_ELECTRON_TARGETS:-linux}"
  export DV_REQUIRE_WIN="${DV_REQUIRE_WIN:-0}"
  bash scripts/package-electron.sh
else
  echo "==> Electron skipped (critical path is mobile-first; set DV_BUILD_ELECTRON=1 to enable)"
fi

echo "==> [collect] downloads into web tree (APK required)"
CURRENT_STAGE="Collect downloads"
notify_step "$CURRENT_STAGE" || true
# Require APK only — desktop installers are optional on the critical path.
export DV_REQUIRE_APK="${DV_REQUIRE_APK:-1}"
export DV_REQUIRE_ALL_DOWNLOADS="${DV_REQUIRE_ALL_DOWNLOADS:-0}"
bash scripts/package-collect-downloads.sh

echo "==> [final] Docker image + push + deploy docvat"
CURRENT_STAGE="Docker + deploy"
notify_step "$CURRENT_STAGE" || true
if [[ ! -d frontend/dist/documentos-vaticanos/downloads ]]; then
  echo "ERROR: downloads missing under frontend dist" >&2
  exit 1
fi
if [[ ! -f frontend/dist/documentos-vaticanos/downloads/documentos-vaticanos.apk ]] \
  && [[ "${DV_REQUIRE_APK:-1}" == "1" ]]; then
  echo "ERROR: APK missing under frontend dist downloads (mobile-first CI)" >&2
  exit 1
fi

bash scripts/ci-docker-push.sh
bash scripts/ci-deploy-docvat.sh

# Optional: upload AAB to Play closed track (post-deploy).
if [[ "${DV_PLAY_UPLOAD:-0}" == "1" ]]; then
  CURRENT_STAGE="Play closed upload"
  notify_step "$CURRENT_STAGE" || true
  echo "==> Play closed-track upload (DV_PLAY_UPLOAD=1) — post-build step"
  export PLAY_PACKAGE_NAME="${PLAY_PACKAGE_NAME:-${DV_PACKAGE_NAME:-com.docvat}}"
  export PLAY_TRACK="${PLAY_TRACK:-closed}"
  export PLAY_AAB_PATH="${PLAY_AAB_PATH:-$ROOT/dist/documentos-vaticanos-release.aab}"
  export PLAY_STATUS="${PLAY_STATUS:-draft}"
  echo "==> Play env package=${PLAY_PACKAGE_NAME} track=${PLAY_TRACK} status=${PLAY_STATUS}"
  if [[ "${PLAY_STATUS}" == "draft" ]]; then
    echo "WARN: PLAY_STATUS=draft — upload will NOT roll out to closed testers until status=completed"
  fi
  if [[ ! -f "${PLAY_AAB_PATH}" ]]; then
    echo "ERROR: AAB missing at ${PLAY_AAB_PATH}" >&2
    exit 1
  fi
  if [[ -z "${PLAY_SERVICE_ACCOUNT_JSON:-}" || ! -f "${PLAY_SERVICE_ACCOUNT_JSON}" ]]; then
    echo "ERROR: PLAY_SERVICE_ACCOUNT_JSON missing or not a readable file" >&2
    exit 2
  fi
  if ! ( cd "$ROOT" && node -e "require('googleapis')" ) 2>/dev/null; then
    echo "==> installing googleapis into ${ROOT}"
    ( cd "$ROOT" && npm install googleapis@^144.0.0 --no-save --no-fund --no-audit ) \
      || ( cd "$ROOT" && npm install googleapis --no-save --no-fund --no-audit ) \
      || {
        echo "ERROR: could not install googleapis" >&2
        exit 2
      }
  fi
  if ! node "$ROOT/scripts/play-upload-closed.js"; then
    echo "ERROR: play-upload-closed failed" >&2
    exit 1
  fi
  echo "::DOCVAT_PLAY_UPLOAD_OK::${VERSION}"
else
  echo "==> Play upload skipped (set DV_PLAY_UPLOAD=1 + PLAY_SERVICE_ACCOUNT_JSON)"
fi

notify_done || true
echo "::DOCVAT_BUILD_DONE::${VERSION}"
