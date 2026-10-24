#!/usr/bin/env bash
# One shot: Android emulator + ng serve for live UI work.
# Usage: ./scripts/dev-android-emu.sh   |  yarn dev:android
#
# The emulator runs the last debug APK. Cursor Design Mode uses http://localhost:4200.
# Live reload inside the WebView is a separate step (CAP_LIVE_RELOAD=1 + reinstall).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AVD="${DV_AVD:-medium_phone}"
PORT="${DV_NG_PORT:-4200}"
APP_ID="digital.documentosvaticanos.app"
ACTIVITY="${APP_ID}/.MainActivity"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
EMU_LOG="${DV_EMULATOR_LOG:-/tmp/dv-emulator.log}"
NG_LOG="${DV_NG_SERVE_LOG:-/tmp/dv-ng-serve.log}"

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
export PATH="$SDK/platform-tools:$SDK/emulator:$PATH"

if [[ ! -x "$SDK/emulator/emulator" ]]; then
  echo "[android] no está el emulador en $SDK/emulator/emulator" >&2
  exit 1
fi
if [[ ! -x "$SDK/platform-tools/adb" ]]; then
  echo "[android] no está adb en $SDK/platform-tools/adb" >&2
  exit 1
fi
if [[ -z "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  echo "[android] no hay DISPLAY ni WAYLAND_DISPLAY; la ventana del emulador no va a verse" >&2
  exit 1
fi

emulator_listed() {
  adb devices | awk 'NR>1 && $1 ~ /^emulator-/ { found=1 } END { exit !found }'
}

port_open() {
  ss -ltn | awk -v p=":$PORT" '$4 ~ p"$" { found=1 } END { exit !found }'
}

if emulator_listed || pgrep -f "emulator -avd ${AVD}" >/dev/null 2>&1; then
  echo "[android] emulador ya está en marcha ($AVD)"
else
  echo "[android] arrancando AVD $AVD → $EMU_LOG"
  nohup "$SDK/emulator/emulator" -avd "$AVD" -gpu host -netdelay none -netspeed full \
    >"$EMU_LOG" 2>&1 &
  echo "[android] emulator pid $!"
fi

if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/"; then
  echo "[android] ng serve ya responde en http://127.0.0.1:${PORT}/"
elif port_open; then
  echo "[android] el puerto ${PORT} está ocupado y no responde como la app" >&2
  exit 1
else
  echo "[android] arrancando ng serve → $NG_LOG"
  nohup npm --prefix "$ROOT/frontend" run serve:emu >"$NG_LOG" 2>&1 &
  echo "[android] ng serve pid $!"
fi

echo "[android] esperando boot del emulador…"
adb wait-for-device
booted=0
for _ in $(seq 1 40); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
    booted=1
    break
  fi
  sleep 3
done
if [[ "$booted" != "1" ]]; then
  echo "[android] el emulador no terminó de arrancar. Mira $EMU_LOG" >&2
  exit 1
fi

APK=""
for candidate in \
  "$ROOT/dist/documentos-vaticanos-debug.apk" \
  "$ROOT/frontend/android/app/build/outputs/apk/debug/app-debug.apk"
do
  if [[ -f "$candidate" ]]; then
    APK="$candidate"
    break
  fi
done

if adb shell pm path "$APP_ID" >/dev/null 2>&1; then
  echo "[android] $APP_ID ya está instalada"
elif [[ -n "$APK" ]]; then
  echo "[android] instalando $APK"
  adb install -r "$APK"
else
  echo "[android] no hay APK de debug; el emulador queda sin la app. Genera una con yarn package:apk" >&2
fi

if adb shell pm path "$APP_ID" >/dev/null 2>&1; then
  adb shell am start -n "$ACTIVITY" >/dev/null
  echo "[android] app al frente: $ACTIVITY"
fi

echo "[android] esperando http://127.0.0.1:${PORT}/ …"
ready=0
for _ in $(seq 1 40); do
  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/"; then
    ready=1
    break
  fi
  sleep 3
done
if [[ "$ready" != "1" ]]; then
  echo "[android] ng serve no respondió. Mira $NG_LOG" >&2
  exit 1
fi

echo "[android] listo"
echo "[android] emulador: $AVD"
echo "[android] design mode: http://localhost:${PORT}/"
echo "[android] logs: $EMU_LOG  $NG_LOG"
