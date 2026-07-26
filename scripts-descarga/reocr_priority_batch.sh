#!/usr/bin/env bash
# Sequential local re-OCR for priority Agustín ES volumes (no download).
# Order: residual priority 05 → 15 → 18.
# Phase A: OCR → clean/ only
# Phase B: import + ocr-abc repair (re-segments unitIndex — intentional)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
LOG_DIR="${REOCR_LOG_DIR:-/tmp/dv-reocr-logs}"
mkdir -p "$LOG_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
LOG="$LOG_DIR/priority-batch-$STAMP.log"
SUMMARY="$LOG_DIR/priority-batch-$STAMP.summary.txt"

# Override: REOCR_IDS="id1,id2,id3" or default first priority trio
if [[ -n "${REOCR_IDS:-}" ]]; then
  IFS=',' read -ra IDS <<< "$REOCR_IDS"
else
  IDS=(
    "agustin-05-de-trinitate-es"
    "agustin-15-tratados-escriturarios-es"
    "agustin-18-epistolas-indices-es"
  )
fi

DO_IMPORT="${DO_IMPORT:-1}"
DO_REPAIR="${DO_REPAIR:-1}"
JOBS="${OCR_JOBS:-4}"
DPI="${OCR_DPI:-130}"

exec > >(tee -a "$LOG") 2>&1

log() { echo "$(date -Iseconds) [priority-batch] $*"; }

log "START log=$LOG"
log "jobs=$JOBS dpi=$DPI do_import=$DO_IMPORT do_repair=$DO_REPAIR"
log "ids=${IDS[*]}"
log "policy: local PDF only — no Drive/download"

echo "reocr priority batch $STAMP" > "$SUMMARY"
echo "log=$LOG" >> "$SUMMARY"

# --- Phase A: OCR all to clean ---
for id in "${IDS[@]}"; do
  log "==== PHASE A OCR $id ===="
  if ! bash "$SCRIPTS/reocr_local_volume.sh" \
      --doc-id "$id" \
      --jobs "$JOBS" \
      --dpi "$DPI" \
      --force-rerender
  then
    log "FAIL OCR $id"
    echo "FAIL OCR $id" >> "$SUMMARY"
    continue
  fi
  clean="$REPO/documentos/padres-source/clean/${id}.txt"
  bytes=$(wc -c < "$clean" 2>/dev/null || echo 0)
  log "OK OCR $id clean_bytes=$bytes"
  echo "OK OCR $id bytes=$bytes" >> "$SUMMARY"
done

# --- Phase B: import + repair ---
if [[ "$DO_IMPORT" == "1" ]]; then
  for id in "${IDS[@]}"; do
    clean="$REPO/documentos/padres-source/clean/${id}.txt"
    if [[ ! -s "$clean" ]]; then
      log "SKIP import $id — missing clean"
      echo "SKIP import $id" >> "$SUMMARY"
      continue
    fi
    log "==== PHASE B import $id (unitIndex may change) ===="
    n=$(python3 -c "
import json
from pathlib import Path
inv=json.loads(Path('$REPO/documentos/padres-source/inventory/agustin-volumes.json').read_text())
v=next(x for x in inv['volumes'] if x['corpusDocId']=='$id')
print(v['n'])
")
    if (cd "$SCRIPTS" && npx ts-node --transpile-only ocr_import_agustin_clean.ts --n "$n"); then
      units=$(python3 -c "
import json
from pathlib import Path
p=Path('$REPO/documentos/corpus/documents/$id/content.json')
print(len(json.loads(p.read_text())) if p.exists() else 0)
")
      log "OK import $id unitCount=$units"
      echo "OK import $id units=$units" >> "$SUMMARY"
    else
      log "FAIL import $id"
      echo "FAIL import $id" >> "$SUMMARY"
      continue
    fi

    if [[ "$DO_REPAIR" == "1" ]]; then
      log "==== PHASE B repair $id ===="
      if (cd "$SCRIPTS" && npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids "$id"); then
        log "OK repair $id"
        echo "OK repair $id" >> "$SUMMARY"
      else
        log "FAIL repair $id"
        echo "FAIL repair $id" >> "$SUMMARY"
      fi
    fi
  done
else
  log "import disabled — clean texts only under padres-source/clean/"
fi

log "DONE summary=$SUMMARY"
cat "$SUMMARY"
echo "LOG=$LOG"
echo "SUMMARY=$SUMMARY"
