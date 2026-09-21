#!/usr/bin/env bash
# Decision tests for ensure_android_web_dist (no Angular, no Gradle).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=ensure-android-web-dist.sh
source "$ROOT/scripts/ensure-android-web-dist.sh"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

rm -f "$TMP/built"
run() {
  # Counter lives on disk: ensure_android_web_dist calls run inside a subshell.
  echo 1 >>"$TMP/built"
  mkdir -p "$FRONTEND/dist/documentos-vaticanos/assets/corpus/documents/lg-es"
  printf '<html></html>\n' >"$FRONTEND/dist/documentos-vaticanos/index.html"
  printf 'version:%s\n' "$VERSION_NAME" >"$FRONTEND/dist/documentos-vaticanos/main.js"
  printf '{}\n' >"$FRONTEND/dist/documentos-vaticanos/assets/corpus/documents/lg-es/content.json"
}
build_count() {
  if [[ -f "$TMP/built" ]]; then
    wc -l <"$TMP/built" | tr -d '[:space:]'
  else
    echo 0
  fi
}

seed_dist() {
  local version="$1"
  local with_docs="${2:-1}"
  mkdir -p "$FRONTEND/dist/documentos-vaticanos"
  printf '<html></html>\n' >"$FRONTEND/dist/documentos-vaticanos/index.html"
  printf 'version:%s\n' "$version" >"$FRONTEND/dist/documentos-vaticanos/main.js"
  printf '%s\n' "$version" >"$FRONTEND/dist/documentos-vaticanos/dv-build-version.txt"
  if [[ "$with_docs" == "1" ]]; then
    mkdir -p "$FRONTEND/dist/documentos-vaticanos/assets/corpus/documents/lg-es"
    printf '{}\n' >"$FRONTEND/dist/documentos-vaticanos/assets/corpus/documents/lg-es/content.json"
  fi
}

FRONTEND="$TMP/frontend"
VERSION_NAME="0.0.30"

echo "== reuse when stamp, packs, and bundle match"
rm -f "$TMP/built"
seed_dist "0.0.30"
ensure_android_web_dist
[[ "$(build_count)" == "0" ]]
[[ "$(tr -d '[:space:]' <"$DIST_WEB/dv-build-version.txt")" == "0.0.30" ]]

echo "== rebuild when stamp is an older release"
rm -f "$TMP/built"
seed_dist "0.0.28"
ensure_android_web_dist
[[ "$(build_count)" == "1" ]]
[[ "$(tr -d '[:space:]' <"$DIST_WEB/dv-build-version.txt")" == "0.0.30" ]]
grep -F -q '0.0.30' "$DIST_WEB/main.js"

echo "== rebuild when dist has no reading packs"
rm -f "$TMP/built"
rm -rf "$FRONTEND/dist"
seed_dist "0.0.30" 0
ensure_android_web_dist
[[ "$(build_count)" == "1" ]]
[[ -d "$DIST_WEB/assets/corpus/documents" ]]

echo "OK ensure-android-web-dist"
