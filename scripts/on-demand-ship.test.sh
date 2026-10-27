#!/usr/bin/env bash
# An on-demand pack is not copied into assets, and a folder already there is removed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SRC="$TMP/canonical"
DST="$TMP/assets"
mkdir -p "$SRC/documents/keep-es" "$SRC/documents/later-es" "$DST/documents/later-es"
printf '%s\n' '{"consecutivo":"1","contenido":"Texto que no debe cambiar."}' >"$SRC/documents/keep-es/content.json"
printf '%s\n' '{"consecutivo":"1","contenido":"Este pack no entra en la app."}' >"$SRC/documents/later-es/content.json"
printf '%s\n' '{"consecutivo":"1","contenido":"Ya estaba en assets."}' >"$DST/documents/later-es/content.json"
python3 - << PY
import json
manifest = {
  "documents": [
    {"id": "keep-es", "bodyPath": "documents/keep-es/content.json"},
    {"id": "later-es", "bodyPath": "documents/later-es/content.json"},
  ]
}
open("$SRC/manifest.json", "w").write(json.dumps(manifest))
sources = {
  "schemaVersion": 1,
  "sources": [
    {"id": "later", "corpusDocId": "later-es", "packaging": "on-demand", "seedUrls": ["https://www.vatican.va/example.html"]},
    {"id": "keep", "corpusDocId": "keep-es", "packaging": "ship", "seedUrls": ["https://www.vatican.va/keep.html"]},
  ],
}
open("$TMP/sources.json", "w").write(json.dumps(sources))
PY

before="$(sha256sum "$SRC/documents/keep-es/content.json" | awk '{print $1}')"
SHIP_SOURCES="$TMP/sources.json" \
  CORPUS_CANONICAL="$SRC" \
  CORPUS_ASSETS="$DST" \
  bash "$ROOT/scripts/corpus-sync-assets.sh"

[[ -f "$DST/documents/keep-es/content.json" ]]
[[ ! -e "$DST/documents/later-es" ]]
after="$(sha256sum "$DST/documents/keep-es/content.json" | awk '{print $1}')"
[[ "$before" == "$after" ]]
python3 - << PY
import json
man = json.load(open("$DST/manifest.json"))
ids = [d["id"] for d in man["documents"]]
assert ids == ["keep-es"], ids
PY

# A later sync of that id alone must not put it back.
SHIP_SOURCES="$TMP/sources.json" \
  CORPUS_CANONICAL="$SRC" \
  CORPUS_ASSETS="$DST" \
  bash "$ROOT/scripts/corpus-sync-assets.sh" later-es
[[ ! -e "$DST/documents/later-es" ]]

ids="$(SHIP_SOURCES="$TMP/sources.json" node "$ROOT/scripts/ship-exclude-ids.js")"
[[ "$ids" == "later-es" ]]
echo "on-demand ship ok"
