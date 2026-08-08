#!/usr/bin/env bash
# OS-level parallel re-OCR wave (max CPU, no agents).
#
# Packing model (8-core example):
#   WORKERS=4 OCR_JOBS=2  → ~8 concurrent tesseract (OMP_THREAD_LIMIT=1 each)
#   WORKERS=2 OCR_JOBS=4  → fewer volumes, more threads each
#
# Usage:
#   REOCR_IDS=id1,id2,id3 WORKERS=4 OCR_JOBS=2 ./reocr_parallel_wave.sh
#   PHASE=ocr|import|all (default all)  DO_IMPORT=0 for OCR-only barrier
#   IMPORT_PARALLEL=1 — fan-out import+repair (default 1 when PHASE=all|import)
#   REOCR_COMMIT=1 — one serial commit (never push)
set -euo pipefail
export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
LOG_DIR="${REOCR_LOG_DIR:-/tmp/dv-reocr-logs}"
mkdir -p "$LOG_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
LOG="${REOCR_WAVE_LOG:-$LOG_DIR/parallel-wave-$STAMP.log}"
SUMMARY="${REOCR_WAVE_SUMMARY:-$LOG_DIR/parallel-wave-$STAMP.summary.txt}"

IDS_CSV="${REOCR_IDS:?need REOCR_IDS}"
# Auto-tune WORKERS if unset: floor(nproc/2) capped 4, min 1
NPROC=$(nproc 2>/dev/null || echo 8)
if [[ -z "${WORKERS:-}" ]]; then
  WORKERS=$(( NPROC / 2 ))
  (( WORKERS < 1 )) && WORKERS=1
  (( WORKERS > 4 )) && WORKERS=4
fi
if [[ -z "${OCR_JOBS:-}" ]]; then
  # keep workers*jobs ≈ nproc
  JOBS=$(( NPROC / WORKERS ))
  (( JOBS < 2 )) && JOBS=2
  (( JOBS > 8 )) && JOBS=8
else
  JOBS="$OCR_JOBS"
fi

PHASE="${PHASE:-all}"          # ocr | import | all
DO_IMPORT="${DO_IMPORT:-1}"
DO_REPAIR="${DO_REPAIR:-1}"
DO_COMMIT="${REOCR_COMMIT:-0}"
IMPORT_PARALLEL="${IMPORT_PARALLEL:-1}"
DPI="${OCR_DPI:-130}"

if [[ "$PHASE" == "ocr" ]]; then
  DO_IMPORT=0
  DO_REPAIR=0
  DO_COMMIT=0
elif [[ "$PHASE" == "import" ]]; then
  : # skip OCR loop below
fi

IFS=',' read -ra IDS <<< "$IDS_CSV"
# trim whitespace
_clean=()
for id in "${IDS[@]}"; do
  id="${id// /}"
  [[ -n "$id" ]] && _clean+=("$id")
done
IDS=("${_clean[@]}")

exec > >(tee -a "$LOG") 2>&1
log(){ echo "$(date -Iseconds) [parallel-wave] $*"; }

log "START log=$LOG"
log "ids=${#IDS[@]} workers=$WORKERS jobs=$JOBS nproc=$NPROC threads≈$((WORKERS*JOBS)) phase=$PHASE"
log "import=$DO_IMPORT repair=$DO_REPAIR commit=$DO_COMMIT import_parallel=$IMPORT_PARALLEL"
echo "parallel-wave $STAMP ids=${IDS[*]} workers=$WORKERS jobs=$JOBS phase=$PHASE" > "$SUMMARY"

ocr_ok=()
ocr_fail=()

if [[ "$PHASE" != "import" ]]; then
  i=0
  n=${#IDS[@]}
  while (( i < n )); do
    pids=()
    batch=()
    for ((w=0; w<WORKERS && i<n; w++, i++)); do
      id="${IDS[$i]}"
      batch+=("$id")
      log "OCR start $id (jobs=$JOBS dpi=$DPI)"
      (
        OCR_JOBS="$JOBS" bash "$SCRIPTS/reocr_local_volume.sh" \
          --doc-id "$id" --jobs "$JOBS" --dpi "$DPI" --force-rerender
      ) &
      pids+=($!)
    done
    log "OCR batch wait: ${batch[*]}"
    bi=0
    for pid in "${pids[@]}"; do
      id="${batch[$bi]}"
      if wait "$pid"; then
        clean="$REPO/documentos/padres-source/clean/${id}.txt"
        bytes=$(wc -c < "$clean" 2>/dev/null || echo 0)
        log "OK OCR $id bytes=$bytes"
        echo "OK OCR $id bytes=$bytes" >> "$SUMMARY"
        ocr_ok+=("$id")
      else
        log "FAIL OCR $id"
        echo "FAIL OCR $id" >> "$SUMMARY"
        ocr_fail+=("$id")
      fi
      bi=$((bi + 1))
    done
  done
else
  # import-only: assume all ids are OCR-ready
  ocr_ok=("${IDS[@]}")
fi

import_ok=()
import_fail=()

run_import_one() {
  local id="$1"
  local clean="$REPO/documentos/padres-source/clean/${id}.txt"
  if [[ ! -s "$clean" ]]; then
    log "SKIP import $id — missing clean"
    echo "SKIP import $id" >> "$SUMMARY"
    return 1
  fi
  local nvol
  nvol=$(python3 -c "import json;from pathlib import Path;inv=json.loads(Path('$REPO/documentos/padres-source/inventory/agustin-volumes.json').read_text());print(next(v['n'] for v in inv['volumes'] if v['corpusDocId']=='$id'))")
  log "import $id n=$nvol"
  if ! (cd "$SCRIPTS" && npx ts-node --transpile-only ocr_import_agustin_clean.ts --n "$nvol"); then
    log "FAIL import $id"
    echo "FAIL import $id" >> "$SUMMARY"
    return 1
  fi
  if [[ "$DO_REPAIR" == "1" ]]; then
    if ! (cd "$SCRIPTS" && npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids "$id"); then
      log "FAIL repair $id"
      echo "FAIL repair $id" >> "$SUMMARY"
      return 1
    fi
  fi
  log "OK import $id"
  echo "OK import $id" >> "$SUMMARY"
  return 0
}

if [[ "$DO_IMPORT" == "1" && ${#ocr_ok[@]} -gt 0 ]]; then
  if [[ "$IMPORT_PARALLEL" == "1" && ${#ocr_ok[@]} -gt 1 ]]; then
    log "import fan-out ${#ocr_ok[@]} (parallel)"
    pids=()
    for id in "${ocr_ok[@]}"; do
      ( run_import_one "$id" ) &
      pids+=($!)
    done
    ii=0
    for pid in "${pids[@]}"; do
      id="${ocr_ok[$ii]}"
      if wait "$pid"; then
        import_ok+=("$id")
      else
        import_fail+=("$id")
      fi
      ii=$((ii + 1))
    done
  else
    for id in "${ocr_ok[@]}"; do
      if run_import_one "$id"; then
        import_ok+=("$id")
      else
        import_fail+=("$id")
      fi
    done
  fi
fi

if [[ "$DO_COMMIT" == "1" ]]; then
  cd "$REPO"
  stage_ids=("${import_ok[@]}")
  if [[ ${#stage_ids[@]} -eq 0 && "$DO_IMPORT" != "1" ]]; then
    stage_ids=("${ocr_ok[@]}")
  fi
  for id in "${stage_ids[@]}"; do
    git add "documentos/corpus/documents/${id}/" "frontend/src/assets/corpus/documents/${id}/" \
      "documentos/padres-source/clean/${id}.txt" "documentos/corpus/revisions/ocr-abc/${id}.json" 2>/dev/null || true
  done
  git add documentos/corpus/manifest.json frontend/src/assets/corpus/manifest.json \
    documentos/corpus/ocr-abc-inventory.json documentos/corpus/ocr-reocr-queue.json \
    documentos/corpus/revisions/ocr-abc/_summary.json documentos/registry/downloaded-documents.json 2>/dev/null || true
  if ! git diff --cached --quiet 2>/dev/null; then
    git commit -m "feat(corpus): parallel re-OCR wave (local only, no push)

unitIndex resegmented for: ${IDS_CSV}"
    log "committed"
    echo "COMMIT ok" >> "$SUMMARY"
  else
    log "nothing to commit"
    echo "COMMIT empty" >> "$SUMMARY"
  fi
fi

log "DONE summary ocr_ok=${#ocr_ok[@]} ocr_fail=${#ocr_fail[@]} import_ok=${#import_ok[@]} import_fail=${#import_fail[@]}"
echo "DONE ocr_ok=${#ocr_ok[@]} ocr_fail=${#ocr_fail[@]} import_ok=${#import_ok[@]} import_fail=${#import_fail[@]}" >> "$SUMMARY"
log DONE

