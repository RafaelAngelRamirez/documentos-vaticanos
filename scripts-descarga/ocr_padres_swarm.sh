#!/usr/bin/env bash
# Parallel OCR swarm for image-only Agustín volumes.
# Renders missing PDFs, then runs a GLOBAL worker pool (default: nproc) over all pending pages.
#
#   ./ocr_padres_swarm.sh
#   ./ocr_padres_swarm.sh --jobs 8 --volumes 12,33,36,37
#   ./ocr_padres_swarm.sh --import
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1
export TESSDATA_PREFIX="${TESSDATA_PREFIX:-/home/linuxbrew/.linuxbrew/share/tessdata}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PDF_DIR="$REPO/documentos/padres-source/pdf"
WORK_ROOT=/tmp/agustin-ocr
JOBS="$(nproc 2>/dev/null || echo 8)"
DPI=130
LANG=spa_fast
DO_IMPORT=0
# default image-only volumes we already know need OCR
VOLUMES="12,33,36,37"

declare -A DOCID_MAP=(
  [12]="agustin-12-tratados-morales-es"
  [33]="agustin-33-antidonatistas-2-es"
  [36]="agustin-36-antipelagianos-4-es"
  [37]="agustin-37-antipelagianos-5-es"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --jobs) JOBS="$2"; shift 2 ;;
    --dpi) DPI="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    --volumes) VOLUMES="$2"; shift 2 ;;
    --import) DO_IMPORT=1; shift ;;
    *) echo "Unknown: $1"; exit 2 ;;
  esac
done

if [[ ! -f "$TESSDATA_PREFIX/${LANG}.traineddata" ]]; then
  LANG=spa
fi

log() { echo "$(date -Iseconds) [swarm] $*"; }

mkdir -p "$WORK_ROOT"
IFS=',' read -ra VOLS <<< "$VOLUMES"

# --- 1) Render all volumes (sequential pdftoppm; parallel would thrash disk) ---
for n in "${VOLS[@]}"; do
  n=$(echo "$n" | tr -d ' ')
  DOCID="${DOCID_MAP[$n]:-agustin-${n}-es}"
  PDF="$PDF_DIR/agustin-${n}.pdf"
  WORK="$WORK_ROOT/$DOCID"
  mkdir -p "$WORK/pages" "$WORK/txt" "$WORK/small"
  if [[ ! -f "$PDF" ]]; then
    log "MISSING pdf $PDF — skip"
    continue
  fi
  PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/{print $2}')
  HAVE=$(find "$WORK/pages" -maxdepth 1 -name 'p-*.png' 2>/dev/null | wc -l | tr -d ' ')
  log "vol $n doc=$DOCID pages=$PAGES rendered=$HAVE"
  if [[ "$HAVE" -lt "$PAGES" ]]; then
    log "rendering $DOCID …"
    # clean partial non-normalized names then render full
    pdftoppm -r "$DPI" -png "$PDF" "$WORK/pages/p"
    for f in "$WORK/pages"/p-*.png; do
      [[ -f "$f" ]] || continue
      base=$(basename "$f" .png)
      num=${base#p-}
      num=$((10#$num))
      dest=$(printf '%s/pages/p-%03d.png' "$WORK" "$num")
      [[ "$f" == "$dest" ]] || mv -f "$f" "$dest" 2>/dev/null || true
    done
    HAVE=$(find "$WORK/pages" -maxdepth 1 -name 'p-*.png' | wc -l | tr -d ' ')
    log "rendered $HAVE pages for $DOCID"
  fi
done

# --- 2) Global todo list ---
GLOBAL_TODO="$WORK_ROOT/global_todo.txt"
: > "$GLOBAL_TODO"
for n in "${VOLS[@]}"; do
  n=$(echo "$n" | tr -d ' ')
  DOCID="${DOCID_MAP[$n]:-agustin-${n}-es}"
  WORK="$WORK_ROOT/$DOCID"
  [[ -d "$WORK/pages" ]] || continue
  for img in $(find "$WORK/pages" -maxdepth 1 -name 'p-*.png' | sort -V); do
    base=$(basename "$img" .png)
    if [[ ! -s "$WORK/txt/$base.txt" ]]; then
      # format: WORK_DIR|image_path
      echo "${WORK}|${img}" >> "$GLOBAL_TODO"
    fi
  done
done
TODO_N=$(wc -l < "$GLOBAL_TODO" | tr -d ' ')
log "GLOBAL todo=$TODO_N jobs=$JOBS lang=$LANG"

if [[ "$TODO_N" -eq 0 ]]; then
  log "nothing to OCR"
else
  # --- 3) Global parallel OCR ---
  export AG_LANG="$LANG"
  cat "$GLOBAL_TODO" | xargs -P"$JOBS" -n1 bash -c '
    set +e
    export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
    export OMP_THREAD_LIMIT=1
    pair="$1"
    work="${pair%%|*}"
    img="${pair#*|}"
    lang="$AG_LANG"
    base=$(basename "$img" .png)
    out="$work/txt/$base"
    [ -s "$out.txt" ] && exit 0
    mkdir -p "$work/small" "$work/txt"
    small="$work/small/$$-$base.png"
    convert "$img" -colorspace Gray -resize 65% "$small" 2>/dev/null
    tesseract "$small" "$out" -l "$lang" --psm 6 --oem 1 >/dev/null 2>&1 || \
      tesseract "$small" "$out" -l spa --psm 6 --oem 1 >/dev/null 2>&1
    rm -f "$small"
  ' _
fi

# --- 4) Assemble each volume ---
for n in "${VOLS[@]}"; do
  n=$(echo "$n" | tr -d ' ')
  DOCID="${DOCID_MAP[$n]:-agustin-${n}-es}"
  WORK="$WORK_ROOT/$DOCID"
  TXTN=$(find "$WORK/txt" -maxdepth 1 -name 'p-*.txt' 2>/dev/null | wc -l | tr -d ' ')
  log "assemble $DOCID txt=$TXTN"
  bash "$REPO/scripts-descarga/ocr_padres_volume.sh" \
    --doc-id "$DOCID" \
    --assemble-only \
    ${DO_IMPORT:+--import} || true
done

log "SWARM COMPLETE"
