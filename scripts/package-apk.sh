#!/usr/bin/env bash
# Capacitor production web → sync → assembleDebug → monorepo dist/*.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"
ANDROID="$FRONTEND/android"
OUT_APK="$ROOT/dist/documentos-vaticanos-debug.apk"

run() {
  if [[ -n "${DV_PACKAGE_LOG:-}" ]]; then
    "$@" 2>&1 | tee -a "$DV_PACKAGE_LOG"
    return "${PIPESTATUS[0]}"
  else
    "$@"
  fi
}

cd "$FRONTEND"
echo "==> Production build + Capacitor sync"
run npm run build:cap

# Prove web assets landed in Android public assets
PUBLIC_DIR="$ANDROID/app/src/main/assets/public"
if [[ ! -f "$PUBLIC_DIR/index.html" ]]; then
  echo "ERROR: Cap sync did not copy index.html to $PUBLIC_DIR" >&2
  exit 1
fi
if [[ ! -f "$PUBLIC_DIR/assets/corpus/manifest.json" ]]; then
  echo "WARN: corpus not under public assets (check Cap webDir copy)" >&2
fi

if [[ ! -x "$ANDROID/gradlew" ]]; then
  echo "ERROR: missing $ANDROID/gradlew" >&2
  exit 1
fi

# Ensure SDK path if local.properties exists
if [[ -f "$ANDROID/local.properties" ]]; then
  echo "==> Using $ANDROID/local.properties"
  cat "$ANDROID/local.properties" || true
fi

echo "==> Gradle assembleDebug"
cd "$ANDROID"
run ./gradlew assembleDebug --no-daemon

APK_SRC="$ANDROID/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK_SRC" ]]; then
  echo "ERROR: APK not produced at $APK_SRC" >&2
  # Honest env note
  if [[ ! -f "$ANDROID/local.properties" ]] && [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
    echo "HINT: Android SDK not configured (local.properties / ANDROID_HOME)." >&2
  fi
  exit 1
fi

mkdir -p "$ROOT/dist"
cp -f "$APK_SRC" "$OUT_APK"

# Validate ZIP/APK structure
if command -v unzip >/dev/null 2>&1; then
  unzip -t "$OUT_APK" >/dev/null
fi
if command -v file >/dev/null 2>&1; then
  file "$OUT_APK"
fi

SIZE=$(stat -c%s "$OUT_APK" 2>/dev/null || stat -f%z "$OUT_APK")
if [[ "$SIZE" -lt 1000000 ]]; then
  echo "ERROR: APK too small ($SIZE bytes)" >&2
  exit 1
fi

{
  echo "artifact=apk"
  echo "builtAt=$(date -Iseconds)"
  echo "source=$APK_SRC"
  echo "bytes=$SIZE"
} >"$ROOT/dist/apk.meta.txt"

echo "OK apk: $OUT_APK ($SIZE bytes)"
