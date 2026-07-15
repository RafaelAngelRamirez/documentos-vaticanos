#!/usr/bin/env bash
# One-shot: web + apk + electron (linux+win) + collect public downloads under web tree.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/dist"

echo "======== package:web ========"
bash "$ROOT/scripts/package-web.sh"

echo "======== package:apk ========"
bash "$ROOT/scripts/package-apk.sh"

echo "======== package:electron ========"
bash "$ROOT/scripts/package-electron.sh"

echo "======== package:collect-downloads ========"
bash "$ROOT/scripts/package-collect-downloads.sh"

echo "======== done ========"
ls -la "$ROOT/dist"
ls -la "$ROOT/dist/web/downloads" 2>/dev/null || true
