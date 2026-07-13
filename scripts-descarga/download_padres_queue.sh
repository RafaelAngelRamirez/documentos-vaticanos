#!/usr/bin/env bash
# Independent download queue for Padres / Agustín BAC PDFs.
# Runs SEPARATELY from OCR/import so network I/O overlaps with CPU work.
#
# Usage:
#   ./download_padres_queue.sh --all-missing          # inventory volumes without local PDF
#   ./download_padres_queue.sh --ns 3,4,6             # specific tomos
#   ./download_padres_queue.sh --all-missing --jobs 4 # parallel downloads
#   ./download_padres_queue.sh --daemon --interval 60 # re-scan inventory periodically
#
# State file: documentos/padres-source/inventory/download-queue-state.json
# PDFs land in: documentos/padres-source/pdf/agustin-N.pdf
#
# Does NOT run OCR or write corpus. Pair with:
#   batch_agustin_pending.sh --skip-download --ns …
#   ocr_padres_volume.sh / ocr_fast_pool.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
INV="$REPO/documentos/padres-source/inventory/agustin-volumes.json"
PDF_DIR="$REPO/documentos/padres-source/pdf"
STATE="$REPO/documentos/padres-source/inventory/download-queue-state.json"
DL="$REPO/scripts-descarga/download_drive_pdf.sh"
LOG_DIR="${PADRES_DL_LOG_DIR:-/tmp/padres-download}"
mkdir -p "$PDF_DIR" "$LOG_DIR"

JOBS=3
NS=""
ALL_MISSING=0
DAEMON=0
INTERVAL=120
MIN_BYTES=10000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --jobs) JOBS="$2"; shift 2 ;;
    --ns) NS="$2"; shift 2 ;;
    --all-missing) ALL_MISSING=1; shift ;;
    --daemon) DAEMON=1; shift ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --min-bytes) MIN_BYTES="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown: $1" >&2; exit 2 ;;
  esac
done

log() { echo "$(date -Iseconds) [dl-queue] $*" | tee -a "$LOG_DIR/queue.log"; }

need_pdf() {
  local n="$1"
  local pdf="$PDF_DIR/agustin-${n}.pdf"
  if [[ ! -f "$pdf" ]]; then return 0; fi
  local sz
  sz=$(stat -c%s "$pdf" 2>/dev/null || echo 0)
  if [[ "$sz" -lt "$MIN_BYTES" ]]; then return 0; fi
  # reject HTML quarantine pages
  if ! head -c 5 "$pdf" | grep -q '%PDF'; then return 0; fi
  return 1
}

build_queue() {
  python3 - "$INV" "$NS" "$ALL_MISSING" <<'PY'
import json, sys
from pathlib import Path
inv = json.loads(Path(sys.argv[1]).read_text())
ns_arg = sys.argv[2]
all_missing = sys.argv[3] == "1"
want = set()
if ns_arg:
    want = {int(x) for x in ns_arg.split(",") if x.strip()}
for v in inv["volumes"]:
    n = v["n"]
    if want and n not in want:
        continue
    if not want and not all_missing:
        continue
    print(json.dumps({
        "n": n,
        "driveFileId": v["driveFileId"],
        "resourceKey": v.get("resourceKey") or "",
        "name": v.get("name") or f"agustin-{n}.pdf",
        "corpusDocId": v["corpusDocId"],
        "sizeBytes": v.get("sizeBytes") or 0,
    }, ensure_ascii=False))
PY
}

download_one() {
  local line="$1"
  local n fid rkey
  n=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin)['n'])")
  fid=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin)['driveFileId'])")
  rkey=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin).get('resourceKey') or '')")
  local out="agustin-${n}.pdf"
  local pdf="$PDF_DIR/$out"

  if ! need_pdf "$n"; then
    log "skip n=$n already present ($(du -h "$pdf" | cut -f1))"
    echo "ok $n skip" >> "$LOG_DIR/results.log"
    return 0
  fi

  log "download n=$n → $out"
  if bash "$DL" "$fid" "$out" "$rkey" >> "$LOG_DIR/dl-$n.log" 2>&1; then
    if need_pdf "$n"; then
      # still missing → treat as fail
      log "FAIL n=$n invalid after download (see $LOG_DIR/dl-$n.log)"
      echo "fail $n invalid" >> "$LOG_DIR/results.log"
      return 1
    fi
    log "OK n=$n $(du -h "$pdf" | cut -f1)"
    echo "ok $n $(stat -c%s "$pdf")" >> "$LOG_DIR/results.log"
    return 0
  else
    log "FAIL n=$n curl/script error"
    echo "fail $n error" >> "$LOG_DIR/results.log"
    return 1
  fi
}

export -f log need_pdf download_one
export PDF_DIR DL LOG_DIR MIN_BYTES

run_once() {
  local queue tmp
  tmp=$(mktemp)
  build_queue > "$tmp"
  local total
  total=$(wc -l < "$tmp" | tr -d ' ')
  if [[ "$total" -eq 0 ]]; then
    log "queue empty (nothing to download)"
    rm -f "$tmp"
    write_state 0 0
    return 0
  fi

  # filter to those that still need download
  local work
  work=$(mktemp)
  while IFS= read -r line; do
    n=$(echo "$line" | python3 -c "import json,sys; print(json.load(sys.stdin)['n'])")
    if need_pdf "$n"; then
      echo "$line" >> "$work"
    fi
  done < "$tmp"
  rm -f "$tmp"
  local pending
  pending=$(wc -l < "$work" | tr -d ' ')
  log "pending downloads: $pending (jobs=$JOBS)"
  if [[ "$pending" -eq 0 ]]; then
    rm -f "$work"
    write_state 0 0
    return 0
  fi

  # parallel workers via xargs
  # shellcheck disable=SC2016
  cat "$work" | xargs -P"$JOBS" -d '\n' -I{} bash -c 'download_one "$@"' _ {}
  local ok fail
  ok=$(grep -c '^ok ' "$LOG_DIR/results.log" 2>/dev/null || true)
  fail=$(grep -c '^fail ' "$LOG_DIR/results.log" 2>/dev/null || true)
  ok=${ok:-0}
  fail=${fail:-0}
  # grep -c can print "0\n0" in some shells; keep only first integer
  ok=$(echo "$ok" | head -1 | tr -dc '0-9')
  fail=$(echo "$fail" | head -1 | tr -dc '0-9')
  ok=${ok:-0}
  fail=${fail:-0}
  write_state "$pending" "$fail"
  rm -f "$work"
  log "pass done ok=$ok fail=$fail"
}

write_state() {
  local pending="${1:-0}" fail="${2:-0}"
  pending=$(echo "$pending" | head -1 | tr -dc '0-9')
  fail=$(echo "$fail" | head -1 | tr -dc '0-9')
  pending=${pending:-0}
  fail=${fail:-0}
  python3 -c "
import json
from pathlib import Path
from datetime import datetime, timezone
path = Path(r'''$STATE''')
state = {
    'updatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    'lastPending': int('''$pending'''),
    'lastFailHint': int('''$fail'''),
    'pdfDir': 'documentos/padres-source/pdf',
    'note': 'Download-only queue. OCR/import are separate processes.',
}
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(state, indent=2) + '\n')
"
}

if [[ "$ALL_MISSING" -eq 0 && -z "$NS" ]]; then
  echo "Need --all-missing and/or --ns N,N,…" >&2
  exit 2
fi

: > "$LOG_DIR/results.log"
if [[ "$DAEMON" -eq 1 ]]; then
  log "daemon start interval=${INTERVAL}s jobs=$JOBS"
  while true; do
    run_once || true
    sleep "$INTERVAL"
  done
else
  run_once
fi
