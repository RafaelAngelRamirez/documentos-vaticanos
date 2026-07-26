#!/usr/bin/env bash
# Re-OCR a volume from an ALREADY-DOWNLOADED local PDF (never hits Drive/network).
#
# Maps corpus documentId → padres-source/pdf/agustin-NN.pdf via inventory,
# re-runs tesseract via ocr_volume.sh, rewrites clean/, optional import + abc repair.
#
# Usage:
#   ./reocr_local_volume.sh --doc-id agustin-18-epistolas-indices-es
#   ./reocr_local_volume.sh --n 18
#   ./reocr_local_volume.sh --doc-id agustin-05-de-trinitate-es --import --repair
#   ./reocr_local_volume.sh --doc-id agustin-18-epistolas-indices-es --range 200-280 --import
#   ./reocr_local_volume.sh --doc-id … --dry-run
#
# Notes:
#   - Requires local PDF under documentos/padres-source/pdf/ (agustin-NN.pdf).
#   - Full re-import re-segments units (unitCount/unitIndex may change for that pack).
#   - Prefer --range for index/body slices when possible.
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
INV="$REPO/documentos/padres-source/inventory/agustin-volumes.json"
PDF_DIR="$REPO/documentos/padres-source/pdf"
OCR="$SCRIPTS/ocr_volume.sh"

DOC_ID=""
N=""
JOBS="${OCR_JOBS:-4}"
DPI="${OCR_DPI:-130}"
LANG="${OCR_LANG:-spa_fast}"
RANGE=""
DO_IMPORT=0
DO_REPAIR=0
DRY_RUN=0
FORCE_RERENDER=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --doc-id) DOC_ID="$2"; shift 2 ;;
    --n) N="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --dpi) DPI="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    --range) RANGE="$2"; shift 2 ;;
    --import) DO_IMPORT=1; shift ;;
    --repair) DO_REPAIR=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --force-rerender) FORCE_RERENDER=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { echo "$(date -Iseconds) [reocr-local] $*"; }

if [[ ! -f "$INV" ]]; then
  echo "Missing inventory: $INV" >&2
  exit 2
fi

# Resolve volume meta from inventory (local only)
read -r RES_N RES_DOCID RES_TITLE < <(python3 - <<PY
import json, sys
from pathlib import Path
inv = json.loads(Path("$INV").read_text())
vols = inv.get("volumes") or []
doc_id = """$DOC_ID""".strip()
n_s = """$N""".strip()
v = None
if n_s:
    n = int(n_s)
    v = next((x for x in vols if int(x["n"]) == n), None)
elif doc_id:
    v = next((x for x in vols if x.get("corpusDocId") == doc_id), None)
    if v is None and doc_id.startswith("agustin-"):
        # allow bare prefix match for typos? no — exact only
        pass
else:
    print("need --doc-id or --n", file=sys.stderr)
    sys.exit(2)
if not v:
    print(f"not in agustin-volumes inventory: doc_id={doc_id!r} n={n_s!r}", file=sys.stderr)
    sys.exit(3)
title = (v.get("title") or v.get("name") or v["corpusDocId"]).replace("\t", " ")
print(v["n"], v["corpusDocId"], title.replace(" ", "§"))
PY
) || exit $?

TITLE="${RES_TITLE//§/ }"
DOC_ID="$RES_DOCID"
N="$RES_N"
NPAD=$(printf '%02d' "$N")

# Prefer zero-padded name; fall back to unpadded legacy names already on disk
PDF=""
for cand in \
  "$PDF_DIR/agustin-${NPAD}.pdf" \
  "$PDF_DIR/agustin-${N}.pdf" \
  "$PDF_DIR/agustin-${NPAD}-es.pdf"
do
  if [[ -f "$cand" ]] && [[ $(stat -c%s "$cand" 2>/dev/null || echo 0) -ge 10000 ]]; then
    PDF="$cand"
    break
  fi
done

if [[ -z "$PDF" ]]; then
  log "FAIL: no local PDF for n=$N ($DOC_ID). Looked under $PDF_DIR — will NOT download."
  log "Place the file as pdf/agustin-${NPAD}.pdf and re-run."
  exit 4
fi

PAGES=$(pdfinfo "$PDF" 2>/dev/null | awk '/^Pages:/{print $2}')
SIZE=$(du -h "$PDF" | cut -f1)
log "local PDF ok: $PDF ($SIZE, pages=${PAGES:-?})"
log "target doc-id=$DOC_ID title=$TITLE jobs=$JOBS dpi=$DPI lang=$LANG range=${RANGE:-all}"

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "dry-run — would run:"
  echo "  bash $OCR --pdf \"$PDF\" --doc-id \"$DOC_ID\" --source-root padres-source --jobs $JOBS --dpi $DPI --lang $LANG ${RANGE:+--range $RANGE}"
  if [[ "$DO_IMPORT" -eq 1 ]]; then
    echo "  cd $SCRIPTS && npx ts-node --transpile-only ocr_import_agustin_clean.ts --n $N"
    echo "  # WARNING: re-import re-segments units (unitIndex may change)"
  fi
  if [[ "$DO_REPAIR" -eq 1 ]]; then
    echo "  cd $SCRIPTS && npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids $DOC_ID"
  fi
  exit 0
fi

OCR_ARGS=(
  --pdf "$PDF"
  --doc-id "$DOC_ID"
  --source-root padres-source
  --jobs "$JOBS"
  --dpi "$DPI"
  --lang "$LANG"
)
if [[ -n "$RANGE" ]]; then
  OCR_ARGS+=(--range "$RANGE")
fi
if [[ "$FORCE_RERENDER" -eq 1 ]]; then
  # wipe workdir pages so ocr_volume re-renders
  rm -rf "${OCR_WORK_ROOT:-/tmp/dv-ocr}/$DOC_ID/pages" "${OCR_WORK_ROOT:-/tmp/dv-ocr}/$DOC_ID/txt" 2>/dev/null || true
fi

log "OCR start (local PDF only, no download)"
bash "$OCR" "${OCR_ARGS[@]}"

CLEAN="$REPO/documentos/padres-source/clean/${DOC_ID}.txt"
if [[ ! -s "$CLEAN" ]]; then
  log "FAIL: missing clean after OCR: $CLEAN"
  exit 5
fi
log "clean ready: $CLEAN ($(wc -c < "$CLEAN") bytes)"

if [[ "$DO_IMPORT" -eq 1 ]]; then
  log "import corpus from clean (re-segments units — unitIndex may change)"
  (cd "$SCRIPTS" && npx ts-node --transpile-only ocr_import_agustin_clean.ts --n "$N")
  log "import done for $DOC_ID"
fi

if [[ "$DO_REPAIR" -eq 1 ]]; then
  log "apply ocr-abc mechanical repair dual-write"
  (cd "$SCRIPTS" && npx ts-node --transpile-only repair_ocr_noise_corpus.ts --apply --ids "$DOC_ID")
  log "repair done for $DOC_ID"
fi

log "DONE $DOC_ID (local re-OCR only)"
