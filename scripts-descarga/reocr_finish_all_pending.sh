#!/usr/bin/env bash
# Finish local re-OCR for all pending Agustín ES volumes (no re-download).
# Reads pending list from SCRATCH or computes remaining vs done set.
# Batches of BATCH_SIZE (default 3): OCR+import+repair → git commit+push.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
SCRATCH="${REOCR_SCRATCH:-/tmp/grok-goal-360edfb8b040/implementer}"
BATCH_SIZE="${BATCH_SIZE:-3}"
JOBS="${OCR_JOBS:-4}"
DPI="${OCR_DPI:-130}"
DO_IMPORT="${DO_IMPORT:-1}"
DO_REPAIR="${DO_REPAIR:-1}"
PUSH="${REOCR_PUSH:-0}"

mkdir -p "$SCRATCH" /tmp/dv-reocr-logs
MASTER_LOG="$SCRATCH/reocr-finish-all.log"
MASTER_SUMMARY="$SCRATCH/reocr-finish-all.summary.txt"
: > "$MASTER_LOG"
: > "$MASTER_SUMMARY"

log() { echo "$(date -Iseconds) [finish-all] $*" | tee -a "$MASTER_LOG"; }

# Campaign-complete volumes (skip re-OCR theater)
DONE_N="1 3 5 9 15 16 18 29 30"

# Build ordered pending list: residual score desc from queue when available
mapfile -t PENDING < <(REPO="$REPO" SCRATCH="$SCRATCH" python3 - <<'PY'
import json, os
from pathlib import Path
root = Path(os.environ["REPO"])
scratch = Path(os.environ["SCRATCH"])
done = {1, 3, 5, 9, 15, 16, 18, 29, 30}
inv = json.loads((root / "documentos/padres-source/inventory/agustin-volumes.json").read_text())
pdf = root / "documentos/padres-source/pdf"
qpath = root / "documentos/corpus/ocr-reocr-queue.json"
score = {}
if qpath.exists():
    q = json.loads(qpath.read_text())
    for d in q.get("documents") or []:
        score[d["id"]] = d.get("residualScore") or 0
rows = []
for v in inv["volumes"]:
    n = int(v["n"])
    if n in done:
        continue
    id_ = v["corpusDocId"]
    npad = f"{n:02d}"
    ok = False
    for name in (f"agustin-{npad}.pdf", f"agustin-{n}.pdf"):
        p = pdf / name
        if p.exists() and p.stat().st_size >= 10000:
            ok = True
            break
    if not ok:
        print(f"MISSING_PDF {id_}", flush=True)
        continue
    rows.append((score.get(id_, 0), n, id_))
rows.sort(reverse=True)
for s, n, id_ in rows:
    print(id_)
(scratch / "reocr-pending-ordered.txt").write_text("\n".join(r[2] for r in rows) + "\n")
print(f"# count={len(rows)}", file=__import__("sys").stderr)
PY
)

# Filter out comment lines / empty
IDS=()
for line in "${PENDING[@]}"; do
  [[ -z "$line" || "$line" == \#* || "$line" == MISSING_PDF* ]] && continue
  IDS+=("$line")
done

log "pending_count=${#IDS[@]} batch_size=$BATCH_SIZE jobs=$JOBS"
echo "pending_count=${#IDS[@]}" >> "$MASTER_SUMMARY"
printf '%s\n' "${IDS[@]}" | tee "$SCRATCH/reocr-pending-runtime.txt" >> "$MASTER_LOG"

if [[ ${#IDS[@]} -eq 0 ]]; then
  log "nothing pending"
  exit 0
fi

commit_slice() {
  local ids_csv="$1"
  local label="$2"
  cd "$REPO"
  local paths=()
  IFS=',' read -ra arr <<< "$ids_csv"
  for id in "${arr[@]}"; do
    paths+=(
      "documentos/corpus/documents/${id}/"
      "frontend/src/assets/corpus/documents/${id}/"
      "documentos/padres-source/clean/${id}.txt"
      "documentos/corpus/revisions/ocr-abc/${id}.json"
    )
  done
  paths+=(
    documentos/corpus/manifest.json
    frontend/src/assets/corpus/manifest.json
    documentos/corpus/ocr-abc-inventory.json
    documentos/corpus/ocr-reocr-queue.json
    documentos/corpus/revisions/ocr-abc/_summary.json
    documentos/registry/downloaded-documents.json
  )
  git add "${paths[@]}" 2>/dev/null || true
  if git diff --cached --quiet; then
    log "commit skip empty $label"
    return 0
  fi
  git commit -m "feat(corpus): local re-OCR ${label} (no re-download)

Residual-priority Agustín ES slice from existing padres-source PDFs only.
OCR spa_fast + dual-write import + ocr-abc repair; unitIndex resegmented."
  if [[ "$PUSH" == "1" ]]; then
    # remote may advance (CI release commits); rebase then push
    git pull --rebase origin HEAD 2>/dev/null \
      || git pull --rebase origin typescript-migration 2>/dev/null \
      || true
    git push -u origin HEAD || log "WARN push failed $label"
  fi
  log "committed $label"
  echo "COMMIT $label" >> "$MASTER_SUMMARY"
}

# Process in chunks
i=0
total=${#IDS[@]}
while [[ $i -lt $total ]]; do
  chunk=()
  j=0
  while [[ $j -lt $BATCH_SIZE && $((i + j)) -lt $total ]]; do
    chunk+=("${IDS[$((i + j))]}")
    j=$((j + 1))
  done
  i=$((i + j))
  csv=$(IFS=','; echo "${chunk[*]}")
  label=$(IFS=','; echo "${chunk[*]}" | sed 's/agustin-//g;s/-es//g' | tr ',' '+')
  log "==== BATCH $csv ===="
  echo "BATCH_START $csv" >> "$MASTER_SUMMARY"

  if ! REOCR_IDS="$csv" OCR_JOBS="$JOBS" OCR_DPI="$DPI" DO_IMPORT="$DO_IMPORT" DO_REPAIR="$DO_REPAIR" \
      bash "$SCRIPTS/reocr_priority_batch.sh"
  then
    log "BATCH_FAIL $csv"
    echo "BATCH_FAIL $csv" >> "$MASTER_SUMMARY"
    # continue to next batch rather than abort all
    continue
  fi

  # verify dual unit counts for chunk
  python3 - <<PY
import json
from pathlib import Path
root = Path(r"$REPO")
scratch = Path(r"$SCRATCH")
ids = """$csv""".split(",")
out = scratch / "reocr-unitcounts.tsv"
if not out.exists():
    out.write_text("id\tunits_docs\tunits_assets\tclean_bytes\tok\n")
for id in ids:
    cd = root / "documentos/corpus/documents" / id / "content.json"
    ca = root / "frontend/src/assets/corpus/documents" / id / "content.json"
    cl = root / "documentos/padres-source/clean" / f"{id}.txt"
    nd = len(json.loads(cd.read_text())) if cd.exists() else -1
    na = len(json.loads(ca.read_text())) if ca.exists() else -1
    cb = cl.stat().st_size if cl.exists() else 0
    ok = nd > 0 and nd == na and cb > 0
    with out.open("a") as f:
        f.write(f"{id}\t{nd}\t{na}\t{cb}\t{ok}\n")
    print(f"verify {id} units={nd} assets={na} clean={cb} ok={ok}")
    if not ok:
        raise SystemExit(2)
PY
  echo "BATCH_OK $csv" >> "$MASTER_SUMMARY"
  commit_slice "$csv" "$label"
done

log "ALL_BATCHES_DONE"
echo "ALL_BATCHES_DONE" >> "$MASTER_SUMMARY"
cat "$MASTER_SUMMARY"
