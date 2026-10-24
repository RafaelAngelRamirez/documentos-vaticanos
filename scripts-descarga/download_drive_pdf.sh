#!/usr/bin/env bash
# Download a Google Drive file by id (+ optional resourceKey) into padres-source/pdf/
# Usage: ./download_drive_pdf.sh <fileId> <outName.pdf> [resourceKey]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/documentos/padres-source/pdf"
mkdir -p "$OUT_DIR"

ID="${1:?file id}"
NAME="${2:?output filename}"
RKEY="${3:-}"
OUT="$OUT_DIR/$NAME"
COOKIE="$(mktemp)"

url="https://drive.google.com/uc?export=download&id=${ID}&confirm=t"
if [[ -n "$RKEY" ]]; then
  url="${url}&resourcekey=${RKEY}"
fi

echo "→ $OUT"
curl -sL -c "$COOKIE" -b "$COOKIE" -o "$OUT" "$url"
if file "$OUT" | grep -qi 'HTML\|ASCII text'; then
  conf="$(grep -oP 'confirm=\K[0-9A-Za-z_-]+' "$OUT" | head -1 || true)"
  if [[ -n "${conf:-}" ]]; then
    curl -sL -c "$COOKIE" -b "$COOKIE" -o "$OUT" \
      "https://drive.google.com/uc?export=download&id=${ID}&confirm=${conf}"
  fi
fi
rm -f "$COOKIE"
file "$OUT"
ls -lh "$OUT"
