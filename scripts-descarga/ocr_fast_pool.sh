#!/usr/bin/env bash
# Global fast OCR pool: one xargs queue over all pending pages, no ImageMagick convert.
# Optimal on 8-core laptops: ~nproc workers, OMP_THREAD_LIMIT=1, spa_fast, direct tesseract.
#
#   ./ocr_fast_pool.sh                 # default volumes 12,33,36
#   ./ocr_fast_pool.sh --jobs 8
#   ./ocr_fast_pool.sh --volumes 12,33,36 --import
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1
export TESSDATA_PREFIX="${TESSDATA_PREFIX:-/home/linuxbrew/.linuxbrew/share/tessdata}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK_ROOT=/tmp/agustin-ocr
# Default to 8 workers (full i5-1145G7 / typical 8-thread laptop).
# If nproc is cgroup-limited to 1, still use 8 for host throughput.
_HOST_JOBS="$(nproc 2>/dev/null || echo 8)"
if [[ "$_HOST_JOBS" -lt 4 ]]; then _HOST_JOBS=8; fi
JOBS="$_HOST_JOBS"
LANG=spa_fast
DO_IMPORT=0
VOLUMES="12,33,36"
# Cap: more than ~nproc+2 usually slows OCR (context thrash)
MAX_JOBS=10

declare -A DOCID=(
  [12]=agustin-12-tratados-morales-es
  [33]=agustin-33-antidonatistas-2-es
  [36]=agustin-36-antipelagianos-4-es
  [37]=agustin-37-antipelagianos-5-es
)
declare -A TITLE=(
  [12]="Tratados morales"
  [33]="Escritos Antidonatistas 2"
  [36]="Escritos Antipelagianos 4"
  [37]="Escritos Antipelagianos 5"
)
declare -A DRIVE=(
  [12]="https://drive.google.com/file/d/0B0jwB_jVsocpNGpQaWhOdFdmc2c/view"
  [33]="https://drive.google.com/file/d/0B0jwB_jVsocpRTI3SWFiZGlNSGc/view"
  [36]="https://drive.google.com/file/d/0B0jwB_jVsocpWEhwQUJfYlBROEk/view"
  [37]="https://drive.google.com/file/d/0B0jwB_jVsocpTkhZSEhFZEd0Z0E/view"
)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --jobs) JOBS="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    --volumes) VOLUMES="$2"; shift 2 ;;
    --import) DO_IMPORT=1; shift ;;
    *) echo "Unknown $1"; exit 2 ;;
  esac
done
if (( JOBS > MAX_JOBS )); then JOBS=$MAX_JOBS; fi
if [[ ! -f "$TESSDATA_PREFIX/${LANG}.traineddata" ]]; then LANG=spa; fi

log() { echo "$(date -Iseconds) [fast-pool] $*"; }

# --- stop thrashing competing pools (keep txt progress) ---
python3 - <<'PY'
import os, signal, subprocess
out = subprocess.check_output(["ps", "-eo", "pid,args"], text=True)
killed = 0
for line in out.splitlines()[1:]:
    parts = line.strip().split(None, 1)
    if len(parts) < 2:
        continue
    pid, args = parts
    if "agustin-ocr" not in args:
        continue
    # kill workers / old volume scripts / xargs OCR — not this script
    if any(x in args for x in (
        "tesseract ", "convert ", "xargs ", "ocr_padres_volume.sh",
        "run_ocr_todo", "worker_page",
    )):
        if "ocr_fast_pool" in args:
            continue
        try:
            os.kill(int(pid), signal.SIGTERM)
            killed += 1
        except ProcessLookupError:
            pass
print(f"stopped_old_workers={killed}")
PY
sleep 2

TODO="$WORK_ROOT/fast_todo.txt"
: > "$TODO"
IFS=',' read -ra VOLS <<< "$VOLUMES"
for n in "${VOLS[@]}"; do
  n=$(echo "$n" | tr -d ' ')
  id="${DOCID[$n]:-}"
  [[ -n "$id" ]] || continue
  work="$WORK_ROOT/$id"
  [[ -d "$work/pages" ]] || continue
  mkdir -p "$work/txt"
  # drop empty stubs so they retry
  find "$work/txt" -name 'p-*.txt' -size 0 -delete 2>/dev/null || true
  for img in $(find "$work/pages" -maxdepth 1 -name 'p-*.png' | sort -V); do
    base=$(basename "$img" .png)
    if [[ ! -s "$work/txt/$base.txt" ]]; then
      printf '%s|%s\n' "$work" "$img" >> "$TODO"
    fi
  done
done
N=$(wc -l < "$TODO" | tr -d ' ')
log "pending_pages=$N jobs=$JOBS lang=$LANG (no convert)"

if [[ "$N" -eq 0 ]]; then
  log "nothing pending"
else
    export AG_LANG="$LANG"
  cat "$TODO" | xargs -P"$JOBS" -n1 /tmp/agustin-ocr/fast_worker.sh
fi

# assemble + optional import
for n in "${VOLS[@]}"; do
  n=$(echo "$n" | tr -d ' ')
  id="${DOCID[$n]:-}"
  [[ -n "$id" ]] || continue
  work="$WORK_ROOT/$id"
  txtn=$(find "$work/txt" -name 'p-*.txt' -size +0 2>/dev/null | wc -l | tr -d ' ')
  pagen=$(find "$work/pages" -name 'p-*.png' 2>/dev/null | wc -l | tr -d ' ')
  log "vol $n $id txt=$txtn pages=$pagen"
  bash "$REPO/scripts-descarga/ocr_padres_volume.sh" --doc-id "$id" --assemble-only || true
  clean="$REPO/documentos/padres-source/clean/${id}.txt"
  bytes=$(wc -c < "$clean" 2>/dev/null || echo 0)
  if [[ "$DO_IMPORT" -eq 1 && "$bytes" -gt 50000 ]]; then
    meta="$REPO/documentos/corpus/documents/$id/meta.json"
    if [[ -f "$meta" ]]; then
      uc=$(python3 -c "import json;print(json.load(open('$meta')).get('unitCount',0))")
      if [[ "$uc" -gt 50 ]]; then
        log "skip import $id unitCount=$uc"
        continue
      fi
    fi
    title="${TITLE[$n]:-$id}"
    url="${DRIVE[$n]:-}"
    log "import $id"
    (cd "$REPO/scripts-descarga" && npx ts-node --transpile-only import_plain_text.ts \
      --id "$id" \
      --title "$title" \
      --short "$title" \
      --kind patristic --locale es --mode paragraphs \
      --file "$clean" \
      --author "Agustín de Hipona" \
      --compiler "A. Cedano" \
      --source-url "$url" \
      --source-note "Compilación digital del P. A. Cedano (sacerdote). OCR tesseract spa_fast del PDF escaneado BAC tomo ${n}.") || true
  fi
done

log "DONE"
