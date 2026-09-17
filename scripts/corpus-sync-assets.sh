#!/usr/bin/env bash
# Copy the ship subset of documentos/corpus/ into frontend/src/assets/corpus/.
# Canonical pack stays in documentos/corpus/. Assets is a generated copy.
#
# Usage:
#   bash scripts/corpus-sync-assets.sh            # documents + manifest + packs
#   bash scripts/corpus-sync-assets.sh <docId>    # one document + manifest.json
#
# Env:
#   CORPUS_CANONICAL  override source root
#   CORPUS_ASSETS     override destination root
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${CORPUS_CANONICAL:-$ROOT/documentos/corpus}"
DST="${CORPUS_ASSETS:-$ROOT/frontend/src/assets/corpus}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,14p' "$0"
  exit 0
fi

if [[ ! -d "$SRC" ]]; then
  echo "ERROR: canonical corpus missing: $SRC" >&2
  exit 1
fi

RSYNC_EXCLUDES=(
  --exclude 'ocr-*-inventory.json'
  --exclude 'revisions/'
  --exclude 'pending-documents.json'
  --exclude 'unlinked-refs-worksheet.json'
)

copy_rel() {
  local rel="$1"
  local from="$SRC/$rel"
  local to="$DST/$rel"
  if [[ ! -e "$from" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "$to")"
  if [[ -d "$from" ]]; then
    mkdir -p "$to"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a "${RSYNC_EXCLUDES[@]}" "$from/" "$to/"
    else
      cp -a "$from/." "$to/"
    fi
  else
    if command -v rsync >/dev/null 2>&1; then
      rsync -a "$from" "$to"
    else
      cp -a "$from" "$to"
    fi
  fi
}

DOC_ID="${1:-}"
mkdir -p "$DST"

if [[ -n "$DOC_ID" ]]; then
  if [[ "$DOC_ID" == *"/"* || "$DOC_ID" == *".."* ]]; then
    echo "ERROR: invalid document id: $DOC_ID" >&2
    exit 1
  fi
  if [[ ! -d "$SRC/documents/$DOC_ID" ]]; then
    echo "ERROR: missing document $DOC_ID under $SRC/documents" >&2
    exit 1
  fi
  copy_rel "documents/$DOC_ID"
  copy_rel "manifest.json"
  echo "OK corpus sync: documents/$DOC_ID + manifest.json → $DST"
  exit 0
fi

copy_rel "documents"
copy_rel "manifest.json"
copy_rel "papacy"
copy_rel "santoral"
copy_rel "search"
copy_rel "context"

echo "OK corpus sync: ship subset → $DST"
