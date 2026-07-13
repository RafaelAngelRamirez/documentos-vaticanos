#!/usr/bin/env bash
# Render (pdftoppm) + OCR (tesseract) one scanned PDF in parallel.
#
#   ./ocr_padres_volume.sh --pdf ../documentos/padres-source/pdf/agustin-12.pdf \
#     --doc-id agustin-12-tratados-morales-es --jobs 4
#
# Options:
#   --pdf PATH          PDF file
#   --doc-id ID         corpus / work dir id
#   --jobs N            parallel tesseract workers (default 4)
#   --dpi N             render dpi (default 130)
#   --lang LANG         tesseract lang (default spa_fast, fallback spa)
#   --range A-B         only OCR page range (after render), e.g. 1-100
#   --skip-render       assume pages already in workdir
#   --assemble-only     only stitch txt → clean/raw
#   --import            after assemble, import into corpus
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1
export TESSDATA_PREFIX="${TESSDATA_PREFIX:-/home/linuxbrew/.linuxbrew/share/tessdata}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PDF=""
DOCID=""
JOBS=4
DPI=130
LANG="spa_fast"
RANGE=""
SKIP_RENDER=0
ASSEMBLE_ONLY=0
DO_IMPORT=0
WORK_ROOT="${OCR_WORK_ROOT:-/tmp/agustin-ocr}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pdf) PDF="$2"; shift 2 ;;
    --doc-id) DOCID="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --dpi) DPI="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    --range) RANGE="$2"; shift 2 ;;
    --skip-render) SKIP_RENDER=1; shift ;;
    --assemble-only) ASSEMBLE_ONLY=1; shift ;;
    --import) DO_IMPORT=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$DOCID" ]] || { echo "need --doc-id"; exit 2; }
WORK="$WORK_ROOT/$DOCID"
mkdir -p "$WORK/pages" "$WORK/txt" "$WORK/small"

log() { echo "$(date -Iseconds) [$DOCID] $*"; }

# Prefer spa_fast if present
if [[ ! -f "$TESSDATA_PREFIX/${LANG}.traineddata" ]]; then
  if [[ -f "$TESSDATA_PREFIX/spa.traineddata" ]]; then
    LANG=spa
  elif [[ -f /tmp/tessfast/spa.traineddata ]]; then
    export TESSDATA_PREFIX=/tmp/tessfast
    LANG=spa
  fi
fi

if [[ "$ASSEMBLE_ONLY" -eq 0 ]]; then
  [[ -n "$PDF" && -f "$PDF" ]] || { echo "need existing --pdf"; exit 2; }
  PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/{print $2}')
  log "pages=$PAGES dpi=$DPI jobs=$JOBS lang=$LANG tessdata=$TESSDATA_PREFIX"

  if [[ "$SKIP_RENDER" -eq 0 ]]; then
    HAVE=$(find "$WORK/pages" -maxdepth 1 -name 'p-*.png' 2>/dev/null | wc -l)
    if [[ "$HAVE" -lt "$PAGES" ]]; then
      log "render pdftoppm ($HAVE/$PAGES present)"
      # pdftoppm names p-1.png or p-01.png depending on version; force 3-digit via loop if needed
      pdftoppm -r "$DPI" -png "$PDF" "$WORK/pages/p"
      # normalize names to p-001.png
      for f in "$WORK/pages"/p-*.png; do
        [[ -f "$f" ]] || continue
        base=$(basename "$f" .png)
        num=${base#p-}
        num=$((10#$num))
        dest=$(printf '%s/pages/p-%03d.png' "$WORK" "$num")
        if [[ "$f" != "$dest" ]]; then
          mv -f "$f" "$dest" 2>/dev/null || true
        fi
      done
    else
      log "render skip ($HAVE pages)"
    fi
  fi

  # build todo list
  TODO="$WORK/todo.txt"
  : > "$TODO"
  RANGE_START=1
  RANGE_END=99999
  if [[ -n "$RANGE" ]]; then
    RANGE_START=${RANGE%-*}
    RANGE_END=${RANGE#*-}
  fi

  for img in $(find "$WORK/pages" -maxdepth 1 -name 'p-*.png' | sort -V); do
    base=$(basename "$img" .png)
    num=${base#p-}
    num=$((10#$num))
    if (( num < RANGE_START || num > RANGE_END )); then
      continue
    fi
    if [[ ! -s "$WORK/txt/$base.txt" ]]; then
      # also check alternate zero-padded name
      printf -v alt 'p-%03d' "$num"
      if [[ -s "$WORK/txt/$alt.txt" ]]; then
        continue
      fi
      echo "$img" >> "$TODO"
    fi
  done
  TODO_N=$(wc -l < "$TODO" | tr -d ' ')
  log "todo OCR pages=$TODO_N"

  if [[ "$TODO_N" -gt 0 ]]; then
    export AG_WORK="$WORK" AG_LANG="$LANG"
    # Direct tesseract (no ImageMagick convert) — fewer processes, less I/O.
    # shellcheck disable=SC2016
    cat "$TODO" | xargs -P"$JOBS" -n1 bash -c '
      export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
      export OMP_THREAD_LIMIT=1
      img="$1"
      work="$AG_WORK"
      lang="$AG_LANG"
      base=$(basename "$img" .png)
      out="$work/txt/$base"
      [ -s "$out.txt" ] && exit 0
      mkdir -p "$work/txt"
      tesseract "$img" "$out" -l "$lang" --psm 6 --oem 1 2>/dev/null || \
        tesseract "$img" "$out" -l spa --psm 6 --oem 1 2>/dev/null || true
    ' _
  fi
fi

TXTN=$(find "$WORK/txt" -maxdepth 1 -name 'p-*.txt' 2>/dev/null | wc -l | tr -d ' ')
log "ocr txt files=$TXTN"

# assemble
RAW_DIR="$REPO/documentos/padres-source/raw"
CLEAN_DIR="$REPO/documentos/padres-source/clean"
mkdir -p "$RAW_DIR" "$CLEAN_DIR"
RAW="$RAW_DIR/${DOCID}.raw.txt"
CLEAN="$CLEAN_DIR/${DOCID}.txt"
: > "$RAW"
for t in $(find "$WORK/txt" -maxdepth 1 -name 'p-*.txt' | sort -V); do
  cat "$t" >> "$RAW"
  printf '\n\n' >> "$RAW"
done
# light clean
python3 - <<PY
from pathlib import Path
import re
raw = Path("$RAW").read_text(encoding="utf-8", errors="replace")
# drop lone page numbers
lines = []
for line in raw.splitlines():
    s = line.strip()
    if re.fullmatch(r"\d{1,4}", s):
        continue
    lines.append(line)
text = "\n".join(lines)
text = re.sub(r"[ \t]+\n", "\n", text)
text = re.sub(r"\n{3,}", "\n\n", text)
# rejoin hyphenation
text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
Path("$CLEAN").write_text(text.strip() + "\n", encoding="utf-8")
print("clean_bytes", Path("$CLEAN").stat().st_size)
PY

if [[ "$DO_IMPORT" -eq 1 ]]; then
  cd "$REPO/scripts-descarga"
  TITLE=$(echo "$DOCID" | sed 's/-es$//;s/-/ /g;s/agustin /Agustín /')
  npx ts-node --transpile-only import_plain_text.ts \
    --id "$DOCID" \
    --title "$TITLE" \
    --short "Agustín" \
    --kind patristic \
    --locale es \
    --mode paragraphs \
    --file "$CLEAN" \
    --author "Agustín de Hipona" \
    --compiler "A. Cedano" \
    --source-note "Compilación digital del P. A. Cedano (sacerdote). OCR tesseract del PDF escaneado BAC." \
    || true
fi

log "DONE txt=$TXTN clean=$CLEAN"
