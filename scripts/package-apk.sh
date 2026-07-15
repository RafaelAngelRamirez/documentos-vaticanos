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

# --- Java home normalization (CI runner has Temurin 21, not host-specific java-17) ---
resolve_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    echo "$JAVA_HOME"
    return 0
  fi
  # Prefer Temurin 21 (imperium-build-runner), then any jvm under /usr/lib/jvm
  local cand
  for cand in \
    /usr/lib/jvm/temurin-21-jdk-amd64 \
    /usr/lib/jvm/java-21-openjdk-amd64 \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/default-java; do
    if [[ -x "$cand/bin/java" ]]; then
      echo "$cand"
      return 0
    fi
  done
  # Fall back to dirname of `java`
  if command -v java >/dev/null 2>&1; then
    local jbin
    jbin=$(readlink -f "$(command -v java)" 2>/dev/null || command -v java)
    # .../bin/java → parent of bin
    echo "$(cd "$(dirname "$jbin")/.." && pwd)"
    return 0
  fi
  return 1
}

JAVA_RESOLVED="$(resolve_java_home || true)"
if [[ -z "$JAVA_RESOLVED" || ! -x "$JAVA_RESOLVED/bin/java" ]]; then
  echo "ERROR: could not resolve a usable JAVA_HOME" >&2
  exit 1
fi
export JAVA_HOME="$JAVA_RESOLVED"
export PATH="$JAVA_HOME/bin:$PATH"
echo "==> JAVA_HOME=$JAVA_HOME ($("$JAVA_HOME/bin/java" -version 2>&1 | head -1))"

# Strip or rewrite invalid org.gradle.java.home in gradle.properties
GP="$ANDROID/gradle.properties"
if [[ -f "$GP" ]]; then
  if grep -qE '^[[:space:]]*org\.gradle\.java\.home=' "$GP"; then
    PINNED=$(grep -E '^[[:space:]]*org\.gradle\.java\.home=' "$GP" | head -1 | sed 's/.*=//')
    if [[ ! -x "${PINNED}/bin/java" ]]; then
      echo "==> Rewriting invalid org.gradle.java.home=$PINNED → $JAVA_HOME"
      # Remove pin lines; rely on JAVA_HOME env (more portable across hosts)
      sed -i '/^[[:space:]]*org\.gradle\.java\.home=/d' "$GP"
    else
      echo "==> org.gradle.java.home=$PINNED (valid)"
    fi
  fi
fi

# Ensure Android SDK is discoverable for Gradle.
# CI mounts codice-progressio_n8n_android_sdk → frontend/.android-build-tools
# (layout matches Imperium: .android-build-tools/sdk/{platforms,build-tools,...}).
is_android_sdk_root() {
  local d="$1"
  [[ -d "$d/platforms" || -d "$d/build-tools" || -f "$d/platform-tools/adb" ]]
}

if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  for sdkcand in \
    "$FRONTEND/.android-build-tools/sdk" \
    "$FRONTEND/.android-build-tools" \
    "$FRONTEND/android-sdk" \
    "${HOME}/Android/Sdk" \
    /opt/android-sdk; do
    if [[ -d "$sdkcand" ]] && is_android_sdk_root "$sdkcand"; then
      export ANDROID_HOME="$sdkcand"
      export ANDROID_SDK_ROOT="$sdkcand"
      echo "==> ANDROID_HOME=$ANDROID_HOME"
      break
    fi
  done
fi
# If ANDROID_HOME was set externally but points at the tooling root (not sdk/), dig one level
if [[ -n "${ANDROID_HOME:-}" && ! -d "${ANDROID_HOME}/platforms" && -d "${ANDROID_HOME}/sdk/platforms" ]]; then
  export ANDROID_HOME="${ANDROID_HOME}/sdk"
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  echo "==> ANDROID_HOME normalized to $ANDROID_HOME"
fi

# Write/refresh local.properties sdk.dir when ANDROID_HOME is set
if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME" ]]; then
  {
    echo "sdk.dir=$ANDROID_HOME"
  } >"$ANDROID/local.properties"
  echo "==> Wrote $ANDROID/local.properties"
elif [[ -f "$ANDROID/local.properties" ]]; then
  echo "==> Using existing $ANDROID/local.properties"
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
