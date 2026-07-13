#!/usr/bin/env bash
# Download + classify + import pending Agustín volumes from inventory.
#   ./batch_agustin_pending.sh --ns 3,4,6
#   ./batch_agustin_pending.sh --all-pending
set -euo pipefail
export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$REPO/scripts-descarga"
INV="$REPO/documentos/padres-source/inventory/agustin-volumes.json"
PDF_DIR="$REPO/documentos/padres-source/pdf"
CORPUS="$REPO/documentos/corpus/documents"
DL="$SCRIPTS/download_drive_pdf.sh"
TEXT_THRESHOLD=5000
OCR_JOBS="${OCR_JOBS:-4}"

NS=""
ALL=0
SKIP_DL=0
SKIP_OCR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ns) NS="$2"; shift 2 ;;
    --all-pending) ALL=1; shift ;;
    --skip-download) SKIP_DL=1; shift ;;
    --skip-ocr) SKIP_OCR=1; shift ;;
    *) echo "Unknown $1"; exit 2 ;;
  esac
done

log() { echo "$(date -Iseconds) [batch-ag] $*"; }

PENDING=()
if [[ -n "$NS" ]]; then
  IFS=',' read -ra PENDING <<< "$NS"
elif [[ "$ALL" -eq 1 ]]; then
  mapfile -t PENDING < <(python3 -c "
import json
from pathlib import Path
inv=json.loads(Path('$INV').read_text())
corpus=Path('$CORPUS')
for v in inv['volumes']:
    if (corpus/v['corpusDocId']).exists():
        continue
    print(v['n'])
")
else
  echo "Need --ns N,N or --all-pending"; exit 2
fi

log "pending: ${PENDING[*]}"
mkdir -p "$PDF_DIR" /tmp/agustin-ocr

for n in "${PENDING[@]}"; do
  n=$(echo "$n" | tr -d ' ')
  [[ -n "$n" ]] || continue

  read -r fid rkey docid title surl < <(python3 -c "
import json
from pathlib import Path
inv=json.loads(Path('$INV').read_text())
v=next(x for x in inv['volumes'] if x['n']==int('$n'))
title=(v.get('title') or v['name'].replace('.pdf','')).replace('\t',' ')
surl=v.get('sourceUrl') or f\"https://drive.google.com/file/d/{v['driveFileId']}/view\"
print(v['driveFileId'], v.get('resourceKey') or '', v['corpusDocId'], title.replace(' ', '§'), surl)
" | awk '{print $1, $2, $3, $4, $5}')
  title=${title//§/ }

  # safer meta read
  fid=$(python3 -c "import json;from pathlib import Path;v=next(x for x in json.loads(Path('$INV').read_text())['volumes'] if x['n']==int('$n'));print(v['driveFileId'])")
  rkey=$(python3 -c "import json;from pathlib import Path;v=next(x for x in json.loads(Path('$INV').read_text())['volumes'] if x['n']==int('$n'));print(v.get('resourceKey') or '')")
  docid=$(python3 -c "import json;from pathlib import Path;v=next(x for x in json.loads(Path('$INV').read_text())['volumes'] if x['n']==int('$n'));print(v['corpusDocId'])")
  title=$(python3 -c "import json;from pathlib import Path;v=next(x for x in json.loads(Path('$INV').read_text())['volumes'] if x['n']==int('$n'));print(v.get('title') or v['name'].replace('.pdf',''))")
  surl=$(python3 -c "import json;from pathlib import Path;v=next(x for x in json.loads(Path('$INV').read_text())['volumes'] if x['n']==int('$n'));print(v.get('sourceUrl') or 'https://drive.google.com/file/d/'+v['driveFileId']+'/view')")

  npad=$(printf '%02d' "$n")
  pdf="$PDF_DIR/agustin-${npad}.pdf"
  if [[ -d "$CORPUS/$docid" ]] && [[ -f "$CORPUS/$docid/content.json" ]]; then
    log "skip already corpus n=$n"
    continue
  fi

  log "==== n=$n $docid ===="
  if [[ "$SKIP_DL" -eq 0 ]]; then
    if [[ ! -f "$pdf" ]] || [[ $(stat -c%s "$pdf" 2>/dev/null || echo 0) -lt 10000 ]]; then
      log "download $n"
      bash "$DL" "$fid" "agustin-${npad}.pdf" "$rkey" || { log "DOWNLOAD FAIL n=$n"; continue; }
    else
      log "pdf exists $(du -h "$pdf" | cut -f1)"
    fi
  fi
  [[ -f "$pdf" ]] || { log "missing pdf n=$n"; continue; }

  chars=$(pdftotext -enc UTF-8 -nopgbrk "$pdf" - 2>/dev/null | wc -c | tr -d ' ')
  pages=$(pdfinfo "$pdf" 2>/dev/null | awk '/^Pages:/{print $2}')
  log "pages=$pages text_chars=$chars"

  if [[ "$chars" -ge "$TEXT_THRESHOLD" ]]; then
    log "TEXT import n=$n"
    (cd "$SCRIPTS" && npx ts-node --transpile-only import_agustin_volume.ts --n "$n" --skip-download) \
      && log "OK text n=$n" || log "FAIL text n=$n"
  else
    if [[ "$SKIP_OCR" -eq 1 ]]; then
      log "IMAGE needs OCR — skipped n=$n"
      continue
    fi
    log "OCR n=$n jobs=$OCR_JOBS"
    bash "$SCRIPTS/ocr_padres_volume.sh" \
      --pdf "$pdf" --doc-id "$docid" --jobs "$OCR_JOBS" --dpi 130 --lang spa_fast \
      || { log "OCR FAIL n=$n"; continue; }
    clean="$REPO/documentos/padres-source/clean/${docid}.txt"
    if [[ ! -s "$clean" ]] || [[ $(wc -c < "$clean") -lt 5000 ]]; then
      log "empty clean n=$n"; continue
    fi
    (cd "$SCRIPTS" && npx ts-node --transpile-only import_plain_text.ts \
      --id "$docid" --title "$title" --short "Agustín" \
      --kind patristic --locale es --mode paragraphs \
      --file "$clean" \
      --author "Agustín de Hipona" --compiler "A. Cedano" \
      --source-url "$surl" \
      --source-note "Compilación digital del P. A. Cedano (sacerdote). OCR tesseract del PDF escaneado BAC tomo ${n}.") \
      && log "OK ocr-import n=$n" || log "FAIL ocr-import n=$n"
    python3 -c "
import json
from pathlib import Path
p=Path('$INV')
inv=json.loads(p.read_text())
for v in inv['volumes']:
    if v['n']==int('$n'):
        v['status']='imported'
        v['compiler']='A. Cedano'
        v['author']='Agustín de Hipona'
        v['sourceUrl']='$surl'
        if not v.get('title'): v['title']='$title'
p.write_text(json.dumps(inv, ensure_ascii=False, indent=2)+'\n')
"
  fi
done
log "BATCH DONE"
