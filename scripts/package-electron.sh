#!/usr/bin/env bash
# Electron desktop package: Linux (AppImage) + Windows (NSIS via Wine when available).
# Targets CI runner (imperium-build-runner: Wine + i386) and local Linux hosts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"
OUT_DIR="$ROOT/dist/electron"

# Platforms: default both; override with DV_ELECTRON_TARGETS="linux" | "win" | "linux,win"
TARGETS="${DV_ELECTRON_TARGETS:-linux,win}"

run() {
  if [[ -n "${DV_PACKAGE_LOG:-}" ]]; then
    "$@" 2>&1 | tee -a "$DV_PACKAGE_LOG"
    return "${PIPESTATUS[0]}"
  else
    "$@"
  fi
}

cd "$FRONTEND"

if [[ ! -f dist/documentos-vaticanos/index.html ]]; then
  echo "==> No web dist; building production web first"
  run npm run build
fi

# Ship hygiene when Electron packages an existing dist that may not have run package-web
CORPUS_DIST="$FRONTEND/dist/documentos-vaticanos/assets/corpus"
if [[ -f "$CORPUS_DIST/manifest.json" ]]; then
  echo "==> Corpus compress (ship hygiene) → $CORPUS_DIST"
  run node "$ROOT/scripts/corpus-compress.js" --root "$CORPUS_DIST"
fi

echo "==> Assert web dist for Electron"
run node -e "require('./electron/paths').assertWebDistReady()"

echo "==> Ensure electron + electron-builder deps"
if [[ ! -d node_modules/electron ]]; then
  run npm install --save-dev electron@^33.2.0 electron-builder@^25.1.8
fi

mkdir -p "$OUT_DIR"
export ELECTRON_BUILDER_CACHE="${ELECTRON_BUILDER_CACHE:-$ROOT/.cache/electron-builder}"

build_linux() {
  echo "==> electron-builder Linux (dir + AppImage)"
  if ! run npx electron-builder --config.directories.output="$OUT_DIR" --linux dir AppImage; then
    echo "WARN: combined linux targets failed; retrying dir-only"
    run npx electron-builder --config.directories.output="$OUT_DIR" --linux dir
  fi
}

build_win() {
  echo "==> electron-builder Windows (portable/nsis; Wine on non-Windows hosts)"
  # Avoid hung wineboot on first-time rcedit; skip signing in CI
  export CSC_IDENTITY_AUTO_DISCOVERY="${CSC_IDENTITY_AUTO_DISCOVERY:-false}"
  export WINEDLLOVERRIDES="${WINEDLLOVERRIDES:-mscoree,mshtml=}"
  local extra=(--config.win.signAndEditExecutable=false)
  # Prefer portable single-file .exe (more reliable under Wine than full NSIS UI)
  local targets="${DV_WIN_TARGET:-portable}"
  if ! command -v wine >/dev/null 2>&1 && ! command -v wine64 >/dev/null 2>&1; then
    if [[ "${DV_REQUIRE_WIN:-0}" == "1" ]]; then
      echo "ERROR: Wine not found and DV_REQUIRE_WIN=1" >&2
      return 1
    fi
    echo "WARN: Wine not available; skipping Windows electron build (set DV_REQUIRE_WIN=1 to fail)"
    return 0
  fi
  if ! run npx electron-builder --config.directories.output="$OUT_DIR" --win "$targets" "${extra[@]}"; then
    echo "WARN: win $targets failed; retrying dir + zip fallback"
    if run npx electron-builder --config.directories.output="$OUT_DIR" --win dir "${extra[@]}"; then
      if command -v zip >/dev/null 2>&1 && [[ -d "$OUT_DIR/win-unpacked" ]]; then
        local ver
        ver=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
        (cd "$OUT_DIR" && zip -r -q "documentos-vaticanos-${ver}-win-x64.zip" win-unpacked)
      fi
    else
      if [[ "${DV_REQUIRE_WIN:-0}" == "1" ]]; then
        echo "ERROR: Windows electron build failed (DV_REQUIRE_WIN=1)" >&2
        return 1
      fi
      echo "WARN: Windows electron build failed (non-fatal without DV_REQUIRE_WIN)"
      return 0
    fi
  fi
}

IFS=',' read -ra TARR <<<"$TARGETS"
for t in "${TARR[@]}"; do
  t="$(echo "$t" | tr -d '[:space:]')"
  case "$t" in
    linux) build_linux ;;
    win|windows) build_win ;;
    *) echo "WARN: unknown electron target '$t' (use linux|win)" >&2 ;;
  esac
done

# Drop unpacked trees once installers exist — they double peak disk on small CI volumes.
# Keep only shippable files (AppImage, exe, zip, blockmap, latest*.yml, builder meta).
if [[ "${DV_KEEP_ELECTRON_UNPACKED:-0}" != "1" ]]; then
  for d in "$OUT_DIR"/linux-unpacked "$OUT_DIR"/win-unpacked "$OUT_DIR"/mac "$OUT_DIR"/*.AppDir; do
    if [[ -e "$d" ]]; then
      echo "==> removing intermediate electron tree: $d"
      rm -rf "$d"
    fi
  done
fi

{
  echo "artifact=electron"
  echo "builtAt=$(date -Iseconds)"
  echo "out=$OUT_DIR"
  echo "targets=$TARGETS"
  ls -la "$OUT_DIR" 2>/dev/null || true
} >"$ROOT/dist/electron.meta.txt"

echo "OK electron artifacts under $OUT_DIR"
ls -la "$OUT_DIR" || true
