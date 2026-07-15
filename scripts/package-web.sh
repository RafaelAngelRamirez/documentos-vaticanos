#!/usr/bin/env bash
# Production web build → monorepo dist/web (static tree, no further compile).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"
OUT="$ROOT/dist/web"

run() {
  if [[ -n "${DV_PACKAGE_LOG:-}" ]]; then
    "$@" 2>&1 | tee -a "$DV_PACKAGE_LOG"
    return "${PIPESTATUS[0]}"
  else
    "$@"
  fi
}

cd "$FRONTEND"
echo "==> Angular production build"
run npm run build

SRC="$FRONTEND/dist/documentos-vaticanos"
if [[ ! -f "$SRC/index.html" ]]; then
  echo "ERROR: missing $SRC/index.html" >&2
  exit 1
fi
if [[ ! -f "$SRC/assets/corpus/manifest.json" ]]; then
  echo "ERROR: offline corpus missing at $SRC/assets/corpus/manifest.json" >&2
  exit 1
fi

echo "==> Collect web artifact → $OUT"
rm -rf "$OUT"
mkdir -p "$OUT"
# Prefer rsync if available; fall back to cp
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SRC/" "$OUT/"
else
  cp -a "$SRC/." "$OUT/"
fi

# Stable stamp
{
  echo "artifact=web"
  echo "builtAt=$(date -Iseconds)"
  echo "source=frontend/dist/documentos-vaticanos"
} >"$ROOT/dist/web.meta.txt"

echo "OK web: $OUT/index.html"
ls -la "$OUT/index.html" "$OUT/assets/corpus/manifest.json"
