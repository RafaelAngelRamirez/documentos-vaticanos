#!/usr/bin/env bash
# Generic render (pdftoppm) + OCR (tesseract) for scanned PDFs.
# Layout mirrors padres-source / concilios-source:
#   <source-root>/pdf/*.pdf  →  raw/*.raw.txt + clean/*.txt
#
#   ./ocr_volume.sh --pdf ../documentos/padres-source/pdf/agustin-12.pdf \
#     --doc-id agustin-12-tratados-morales-es --source-root padres-source --lang spa_fast
#
#   ./ocr_volume.sh --pdf ../documentos/concilios-source/pdf/nicea-i-la.pdf \
#     --doc-id nicea-i-la --source-root concilios-source --lang lat+eng --import
#
# Options:
#   --pdf PATH          PDF file (required unless --assemble-only)
#   --doc-id ID         corpus / work dir id (required)
#   --source-root NAME  padres-source | concilios-source | absolute path under documentos/
#   --jobs N            parallel tesseract workers (default 4)
#   --dpi N             render dpi (default 130)
#   --lang LANG         tesseract lang (default spa_fast; use lat or lat+eng for councils)
#   --range A-B         only OCR page range
#   --skip-render       assume pages already in workdir
#   --assemble-only     only stitch txt → clean/raw
#   --import            after assemble, import into corpus (council or plain-text)
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:/usr/bin:$PATH"
export OMP_THREAD_LIMIT=1
export TESSDATA_PREFIX="${TESSDATA_PREFIX:-/home/linuxbrew/.linuxbrew/share/tessdata}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PDF=""
DOCID=""
SOURCE_ROOT_NAME="padres-source"
JOBS=4
DPI=130
LANG="spa_fast"
RANGE=""
SKIP_RENDER=0
ASSEMBLE_ONLY=0
DO_IMPORT=0
WORK_ROOT="${OCR_WORK_ROOT:-/tmp/dv-ocr}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pdf) PDF="$2"; shift 2 ;;
    --doc-id) DOCID="$2"; shift 2 ;;
    --source-root) SOURCE_ROOT_NAME="$2"; shift 2 ;;
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

if [[ "$SOURCE_ROOT_NAME" = /* ]]; then
  SOURCE_ROOT="$SOURCE_ROOT_NAME"
else
  SOURCE_ROOT="$REPO/documentos/$SOURCE_ROOT_NAME"
fi
RAW_DIR="$SOURCE_ROOT/raw"
CLEAN_DIR="$SOURCE_ROOT/clean"
mkdir -p "$RAW_DIR" "$CLEAN_DIR"

WORK="$WORK_ROOT/$DOCID"
mkdir -p "$WORK/pages" "$WORK/txt"

log() { echo "$(date -Iseconds) [$DOCID] $*"; }

# Resolve tesseract language (support lat+eng multi)
resolve_lang() {
  local want="$1"
  local primary="${want%%+*}"
  if [[ -f "$TESSDATA_PREFIX/${primary}.traineddata" ]] || [[ "$want" == *+* ]]; then
    # multi: check each part
    local ok=1
    IFS='+' read -ra parts <<< "$want"
    for p in "${parts[@]}"; do
      if [[ ! -f "$TESSDATA_PREFIX/${p}.traineddata" ]]; then
        ok=0
        break
      fi
    done
    if [[ $ok -eq 1 ]]; then
      echo "$want"
      return
    fi
  fi
  if [[ -f "$TESSDATA_PREFIX/lat.traineddata" && "$SOURCE_ROOT_NAME" == *concilio* ]]; then
    echo "lat"
    return
  fi
  if [[ -f "$TESSDATA_PREFIX/spa_fast.traineddata" ]]; then
    echo "spa_fast"
    return
  fi
  if [[ -f "$TESSDATA_PREFIX/spa.traineddata" ]]; then
    echo "spa"
    return
  fi
  echo "eng"
}

LANG="$(resolve_lang "$LANG")"
log "lang=$LANG tessdata=$TESSDATA_PREFIX source=$SOURCE_ROOT"

if [[ "$ASSEMBLE_ONLY" -eq 0 ]]; then
  [[ -n "$PDF" && -f "$PDF" ]] || { echo "need existing --pdf"; exit 2; }
  PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/{print $2}')
  log "pages=$PAGES dpi=$DPI jobs=$JOBS pdf=$PDF"

  if [[ "$SKIP_RENDER" -eq 0 ]]; then
    HAVE=$(find "$WORK/pages" -maxdepth 1 -name 'p-*.png' 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$HAVE" -lt "$PAGES" ]]; then
      log "render pdftoppm ($HAVE/$PAGES present)"
      rm -f "$WORK/pages"/p-*.png 2>/dev/null || true
      pdftoppm -r "$DPI" -png "$PDF" "$WORK/pages/p"
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
    export AG_WORK="$WORK" AG_LANG="$LANG" TESSDATA_PREFIX
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
        tesseract "$img" "$out" -l lat --psm 6 --oem 1 2>/dev/null || \
        tesseract "$img" "$out" -l spa --psm 6 --oem 1 2>/dev/null || \
        tesseract "$img" "$out" -l eng --psm 6 --oem 1 2>/dev/null || true
    ' _
  fi
fi

TXTN=$(find "$WORK/txt" -maxdepth 1 -name 'p-*.txt' 2>/dev/null | wc -l | tr -d ' ')
log "ocr txt files=$TXTN"

RAW="$RAW_DIR/${DOCID}.raw.txt"
CLEAN="$CLEAN_DIR/${DOCID}.txt"
# Also write corpusDocId-style names when doc-id already is that
: > "$RAW"
for t in $(find "$WORK/txt" -maxdepth 1 -name 'p-*.txt' | sort -V); do
  cat "$t" >> "$RAW"
  printf '\n\n' >> "$RAW"
done

python3 - <<PY
from pathlib import Path
import re
raw_path = Path("$RAW")
raw = raw_path.read_text(encoding="utf-8", errors="replace")
lines = []
for line in raw.splitlines():
    s = line.strip()
    if re.fullmatch(r"\d{1,4}", s):
        continue
    lines.append(line)
text = "\n".join(lines)
text = re.sub(r"[ \t]+\n", "\n", text)
text = re.sub(r"\n{3,}", "\n\n", text)
text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
Path("$CLEAN").write_text(text.strip() + "\n", encoding="utf-8")
print("clean_bytes", Path("$CLEAN").stat().st_size)
PY

if [[ "$DO_IMPORT" -eq 1 ]]; then
  cd "$REPO/scripts-descarga"
  if [[ "$SOURCE_ROOT_NAME" == *concilio* ]]; then
    # inventory id is usually without -la suffix
    INV_ID="${DOCID%-la}"
    npx ts-node --transpile-only import_council.ts --id "$INV_ID" || \
      npx ts-node --transpile-only import_council.ts --id "$DOCID" || true
  else
    TITLE=$(echo "$DOCID" | sed 's/-es$//;s/-/ /g;s/agustin /Agustín /')
    npx ts-node --transpile-only import_plain_text.ts \
      --id "$DOCID" \
      --title "$TITLE" \
      --short "Agustín" \
      --kind patristic \
      --locale es \
      --mode paragraphs \
      --file "$CLEAN" \
      --source-note "OCR tesseract del PDF escaneado." \
      || true
  fi
fi

log "DONE txt=$TXTN clean=$CLEAN raw=$RAW"
