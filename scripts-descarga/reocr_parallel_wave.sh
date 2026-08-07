#!/usr/bin/env bash
# OS-level parallel re-OCR wave (max CPU, no agents).
# Usage:
#   REOCR_IDS=id1,id2 WORKERS=2 OCR_JOBS=4 ./reocr_parallel_wave.sh
# Launches up to WORKERS concurrent reocr_local_volume processes; waits; then
# sequential import+repair+optional commit (REOCR_COMMIT=1, never push).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
IDS_CSV="${REOCR_IDS:?need REOCR_IDS}"
WORKERS="${WORKERS:-2}"
JOBS="${OCR_JOBS:-4}"
DO_IMPORT="${DO_IMPORT:-1}"
DO_REPAIR="${DO_REPAIR:-1}"
DO_COMMIT="${REOCR_COMMIT:-0}"

IFS=',' read -ra IDS <<< "$IDS_CSV"
log(){ echo "$(date -Iseconds) [parallel-wave] $*"; }
log "ids=${#IDS[@]} workers=$WORKERS jobs=$JOBS"

# Phase OCR in parallel batches of WORKERS
i=0
n=${#IDS[@]}
while (( i < n )); do
  pids=()
  for ((w=0; w<WORKERS && i<n; w++, i++)); do
    id="${IDS[$i]}"
    log "OCR start $id"
    (
      OCR_JOBS="$JOBS" bash "$SCRIPTS/reocr_local_volume.sh" \
        --doc-id "$id" --jobs "$JOBS" --dpi 130 --force-rerender
    ) &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || log "WARN OCR pid $pid failed"
  done
done

if [[ "$DO_IMPORT" == "1" ]]; then
  for id in "${IDS[@]}"; do
    nvol=$(python3 -c "import json;from pathlib import Path;inv=json.loads(Path('$REPO/documentos/padres-source/inventory/agustin-volumes.json').read_text());print(next(v['n'] for v in inv['volumes'] if v['corpusDocId']=='$id'))")
    log "import $id n=$nvol"
    (cd "$SCRIPTS" && npx ts-node --transpile-only ocr_import_agustin_clean.ts --n "$nvol") || log "FAIL import $id"
    if [[ "$DO_REPAIR" == "1" ]]; then
      (cd "$SCRIPTS" && npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids "$id") || log "FAIL repair $id"
    fi
  done
fi

if [[ "$DO_COMMIT" == "1" ]]; then
  cd "$REPO"
  for id in "${IDS[@]}"; do
    git add "documentos/corpus/documents/${id}/" "frontend/src/assets/corpus/documents/${id}/" \
      "documentos/padres-source/clean/${id}.txt" "documentos/corpus/revisions/ocr-abc/${id}.json" 2>/dev/null || true
  done
  git add documentos/corpus/manifest.json frontend/src/assets/corpus/manifest.json \
    documentos/corpus/ocr-abc-inventory.json documentos/corpus/ocr-reocr-queue.json \
    documentos/corpus/revisions/ocr-abc/_summary.json documentos/registry/downloaded-documents.json 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "feat(corpus): parallel re-OCR wave (local only, no push)

unitIndex resegmented for: ${IDS_CSV}"
    log "committed"
  else
    log "nothing to commit"
  fi
fi
log DONE
