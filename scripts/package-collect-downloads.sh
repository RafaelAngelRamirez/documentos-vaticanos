#!/usr/bin/env bash
# Collect APK + Electron installers into stable public download paths under the web tree.
# Stable names (version-independent) so UI links do not break every bump:
#   /downloads/documentos-vaticanos.apk
#   /downloads/documentos-vaticanos-linux.AppImage
#   /downloads/documentos-vaticanos-windows.exe
#   /downloads/manifest.json
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
WEB_OUT="$DIST/web/downloads"
# Also land under frontend production dist so docker-compilar / Dockerfile pick them up
FE_OUT="$ROOT/frontend/dist/documentos-vaticanos/downloads"
# Source-tree placeholder so Angular asset pipeline can ship an empty folder + manifest
ASSETS_OUT="$ROOT/frontend/src/assets/downloads"

mkdir -p "$WEB_OUT" "$FE_OUT" "$ASSETS_OUT" "$DIST"

# Place a large binary under dest without doubling disk when same filesystem.
# Prefer hardlink (ln -f); fall back to cp. Never write multi-MB bits into src/assets.
place_binary() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  # Same inode already present
  if [[ -f "$dest" ]] && [[ "$src" -ef "$dest" ]]; then
    return 0
  fi
  rm -f "$dest"
  if ln -f "$src" "$dest" 2>/dev/null; then
    return 0
  fi
  cp -f "$src" "$dest"
}

copy_stable() {
  local src="$1"
  local dest_name="$2"
  if [[ ! -f "$src" ]]; then
    echo "WARN: missing source for $dest_name: $src" >&2
    return 1
  fi
  local size
  size=$(stat -c%s "$src" 2>/dev/null || stat -f%z "$src")
  if [[ "$size" -lt 1000000 ]]; then
    echo "ERROR: $src too small ($size bytes) for $dest_name" >&2
    return 1
  fi
  place_binary "$src" "$WEB_OUT/$dest_name"
  # Second tree: hardlink from WEB_OUT when possible (saves a full second copy)
  if ! place_binary "$WEB_OUT/$dest_name" "$FE_OUT/$dest_name"; then
    place_binary "$src" "$FE_OUT/$dest_name"
  fi
  echo "OK collect: $dest_name ($size bytes)"
  return 0
}

find_first() {
  # find_first <glob...> — print first existing file matching any pattern
  local p
  for p in "$@"; do
    # shellcheck disable=SC2086
    local hits
    hits=$(ls -1 $p 2>/dev/null | head -1 || true)
    if [[ -n "$hits" && -f "$hits" ]]; then
      echo "$hits"
      return 0
    fi
  done
  return 1
}

APK_SRC=""
if [[ -f "$DIST/documentos-vaticanos-debug.apk" ]]; then
  APK_SRC="$DIST/documentos-vaticanos-debug.apk"
elif [[ -f "$ROOT/frontend/android/app/build/outputs/apk/debug/app-debug.apk" ]]; then
  APK_SRC="$ROOT/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
fi

LINUX_SRC=""
LINUX_SRC=$(find_first \
  "$DIST/electron/documentos-vaticanos-*-x86_64.AppImage" \
  "$DIST/electron/documentos-vaticanos-*.AppImage" \
  "$DIST/electron/*.AppImage" \
  || true)

WIN_SRC=""
WIN_SRC=$(find_first \
  "$DIST/electron/documentos-vaticanos-*-x64.exe" \
  "$DIST/electron/documentos-vaticanos-*.exe" \
  "$DIST/electron/*.exe" \
  || true)
# Zip of win-unpacked is an acceptable fallback when NSIS/portable hung under Wine
if [[ -z "$WIN_SRC" ]]; then
  WIN_SRC=$(find_first \
    "$DIST/electron/documentos-vaticanos-*-win-x64.zip" \
    "$DIST/electron/*-win-x64.zip" \
    "$DIST/electron/*.zip" \
    || true)
  if [[ -n "$WIN_SRC" ]]; then
    # Still publish as stable .exe name only when source is already .exe;
    # for zip, keep stable windows path as .exe is wrong — use .zip stable name
    WIN_IS_ZIP=1
  fi
fi
WIN_IS_ZIP="${WIN_IS_ZIP:-0}"

HAVE_APK=0
HAVE_LINUX=0
HAVE_WIN=0

if [[ -n "$APK_SRC" ]]; then
  copy_stable "$APK_SRC" "documentos-vaticanos.apk" && HAVE_APK=1 || true
else
  echo "WARN: no APK found under dist/ or android outputs" >&2
fi

if [[ -n "$LINUX_SRC" ]]; then
  copy_stable "$LINUX_SRC" "documentos-vaticanos-linux.AppImage" && HAVE_LINUX=1 || true
else
  echo "WARN: no Linux AppImage under dist/electron" >&2
fi

if [[ -n "$WIN_SRC" ]]; then
  if [[ "$WIN_IS_ZIP" == "1" || "$WIN_SRC" == *.zip ]]; then
    # Prefer stable .exe name when source is exe; zip gets dual publish
    copy_stable "$WIN_SRC" "documentos-vaticanos-windows.zip" && HAVE_WIN=1 || true
    # Also symlink/copy to .exe only if we later have a real exe — never mislabel zip as exe
  else
    copy_stable "$WIN_SRC" "documentos-vaticanos-windows.exe" && HAVE_WIN=1 || true
  fi
else
  echo "WARN: no Windows installer under dist/electron" >&2
fi

VERSION=$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo "0.0.0")
BUILT_AT=$(date -Iseconds)

# Public path for Windows: real .exe preferred, zip fallback.
WIN_PUBLIC_PATH="/downloads/documentos-vaticanos-windows.exe"
if [[ $HAVE_WIN -eq 1 ]]; then
  if [[ -f "$WEB_OUT/documentos-vaticanos-windows.exe" ]]; then
    WIN_PUBLIC_PATH="/downloads/documentos-vaticanos-windows.exe"
  elif [[ -f "$WEB_OUT/documentos-vaticanos-windows.zip" ]]; then
    WIN_PUBLIC_PATH="/downloads/documentos-vaticanos-windows.zip"
  fi
fi

# Always emit stable public paths so UI links never break (404 if binary missing).
# "available" flags note which bits were actually collected this run.
MANIFEST_JSON=$(cat <<EOF
{
  "app": "documentos-vaticanos",
  "version": "$VERSION",
  "builtAt": "$BUILT_AT",
  "available": {
    "apk": $( [[ $HAVE_APK -eq 1 ]] && echo 'true' || echo 'false' ),
    "linux": $( [[ $HAVE_LINUX -eq 1 ]] && echo 'true' || echo 'false' ),
    "windows": $( [[ $HAVE_WIN -eq 1 ]] && echo 'true' || echo 'false' )
  },
  "downloads": {
    "apk": "/downloads/documentos-vaticanos.apk",
    "linux": "/downloads/documentos-vaticanos-linux.AppImage",
    "windows": "$WIN_PUBLIC_PATH"
  }
}
EOF
)

echo "$MANIFEST_JSON" >"$WEB_OUT/manifest.json"
echo "$MANIFEST_JSON" >"$FE_OUT/manifest.json"
# Keep src/assets stub with stable paths only (no huge binaries; version may lag)
cat >"$ASSETS_OUT/manifest.json" <<EOF
{
  "app": "documentos-vaticanos",
  "version": "$VERSION",
  "builtAt": null,
  "downloads": {
    "apk": "/downloads/documentos-vaticanos.apk",
    "linux": "/downloads/documentos-vaticanos-linux.AppImage",
    "windows": "/downloads/documentos-vaticanos-windows.exe"
  }
}
EOF
# Keep a tiny README so assets/downloads is never empty in git
cat >"$ASSETS_OUT/README.md" <<'EOF'
# Downloads (stable public installers)

Installers are produced by `scripts/package-collect-downloads.sh` during CI/package
and land under the production web tree as:

- `/downloads/documentos-vaticanos.apk`
- `/downloads/documentos-vaticanos-linux.AppImage`
- `/downloads/documentos-vaticanos-windows.exe`
- `/downloads/manifest.json`

Binaries are **not** committed here (too large). Only `manifest.json` may be
refreshed in-repo as a stub; real bits are injected into `dist/` by packaging.
EOF

{
  echo "artifact=downloads"
  echo "builtAt=$BUILT_AT"
  echo "version=$VERSION"
  echo "apk=$HAVE_APK"
  echo "linux=$HAVE_LINUX"
  echo "windows=$HAVE_WIN"
  ls -la "$WEB_OUT" 2>/dev/null || true
} >"$DIST/downloads.meta.txt"

echo "======== downloads collected ========"
ls -lah "$WEB_OUT" || true

# Mobile-first CI: require APK only (Electron/Win optional).
if [[ "${DV_REQUIRE_APK:-0}" == "1" ]]; then
  if [[ $HAVE_APK -ne 1 ]]; then
    echo "ERROR: DV_REQUIRE_APK=1 but APK missing (apk=$HAVE_APK linux=$HAVE_LINUX windows=$HAVE_WIN)" >&2
    exit 1
  fi
fi

# Full package:all / desktop matrix — require every platform.
if [[ "${DV_REQUIRE_ALL_DOWNLOADS:-0}" == "1" ]]; then
  if [[ $HAVE_APK -ne 1 || $HAVE_LINUX -ne 1 || $HAVE_WIN -ne 1 ]]; then
    echo "ERROR: DV_REQUIRE_ALL_DOWNLOADS=1 but missing apk=$HAVE_APK linux=$HAVE_LINUX windows=$HAVE_WIN" >&2
    exit 1
  fi
fi

# Soft fail only when nothing was collected
if [[ $HAVE_APK -eq 0 && $HAVE_LINUX -eq 0 && $HAVE_WIN -eq 0 ]]; then
  echo "ERROR: no downloadable installers found to collect" >&2
  exit 1
fi

echo "OK downloads → $WEB_OUT and $FE_OUT"
