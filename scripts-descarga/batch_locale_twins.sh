#!/usr/bin/env bash
# Orchestrate AI locale twins for all ES bases missing en/zh/hi/ar.
# Skips locales that already have a pack (official or AI).
# Usage:
#   bash batch_locale_twins.sh
#   bash batch_locale_twins.sh --locales zh,hi,ar
#   bash batch_locale_twins.sh --max-units 500   # only packs ≤ N units
#   bash batch_locale_twins.sh --only-family na,dv,lg
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts-descarga"
CORPUS="$ROOT/documentos/corpus"
CLEAN="$ROOT/documentos/magisterium-source/clean"
PY="${TRANSLATE_PY:-/tmp/grok-goal-bf844dbde623/implementer/venv/bin/python}"
LOCALES="en,zh,hi,ar"
MAX_UNITS=0
ONLY_FAMILY=""
SLEEP=0.12
LOGDIR="${LOGDIR:-/tmp/grok-goal-bf844dbde623/implementer/batch-locale}"
mkdir -p "$LOGDIR" "$CLEAN"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --locales) LOCALES="$2"; shift 2 ;;
    --max-units) MAX_UNITS="$2"; shift 2 ;;
    --only-family) ONLY_FAMILY="$2"; shift 2 ;;
    --sleep) SLEEP="$2"; shift 2 ;;
    --py) PY="$2"; shift 2 ;;
    *) echo "Unknown $1"; exit 1 ;;
  esac
done

if [[ ! -x "$PY" ]]; then
  python3 -m venv /tmp/grok-goal-bf844dbde623/implementer/venv
  /tmp/grok-goal-bf844dbde623/implementer/venv/bin/pip install -q deep-translator
  PY=/tmp/grok-goal-bf844dbde623/implementer/venv/bin/python
fi

export CORPUS LOCALES MAX_UNITS ONLY_FAMILY
# Build work queue: baseId|locale (env must be set for CORPUS)
mapfile -t JOBS < <(CORPUS="$CORPUS" LOCALES="$LOCALES" MAX_UNITS="$MAX_UNITS" ONLY_FAMILY="$ONLY_FAMILY" "$PY" - <<'PY'
import json, os
from pathlib import Path
corpus = Path(os.environ["CORPUS"])
man = json.loads((corpus / "manifest.json").read_text())
docs = man["documents"]
ids = {d["id"] for d in docs}

def family(id_):
    base = id_[:-3] if id_.endswith("-ai") else id_
    for s in ("-es","-la","-en","-zh","-hi","-ar","-it","-fr","-de","-pt","-el"):
        if base.endswith(s):
            return base[: -len(s)]
    return base

locales = os.environ["LOCALES"].split(",")
max_units = int(os.environ.get("MAX_UNITS") or "0")
only = set(filter(None, os.environ.get("ONLY_FAMILY","").split(",")))
fams = {}
for d in docs:
    f = family(d["id"])
    fams.setdefault(f, []).append(d)
jobs = []
for f, eds in sorted(fams.items()):
    if only and f not in only:
        continue
    es = next((e for e in eds if e.get("locale")=="es" or e["id"].endswith("-es")), None)
    if es:
        base, src_lang = es, "es"
    else:
        la = next((e for e in eds if e.get("locale")=="la" or e["id"].endswith("-la")), None)
        if not la:
            continue
        base, src_lang = la, "la"
    uc = int(base.get("unitCount") or 0)
    if max_units and uc > max_units:
        continue
    for loc in locales:
        has = any(
            (e.get("locale")==loc) or e["id"].endswith(f"-{loc}") or e["id"].endswith(f"-{loc}-ai")
            for e in eds
        )
        if f"{f}-{loc}" in ids or f"{f}-{loc}-ai" in ids:
            has = True
        if has:
            continue
        jobs.append((uc, base["id"], loc, src_lang))
jobs.sort()
for uc, base, loc, src in jobs:
    print(f"{base}|{loc}|{src}|{uc}")
PY
)

echo "[i] jobs=${#JOBS[@]}" | tee "$LOGDIR/orchestrator.log"
done_n=0
fail_n=0
for job in "${JOBS[@]}"; do
  IFS='|' read -r BASE LOC SRC UC <<<"$job"
  fam="${BASE%-es}"
  fam="${fam%-la}"
  echo "=== $BASE → $LOC (units=$UC) ===" | tee -a "$LOGDIR/orchestrator.log"
  if ! "$PY" "$SCRIPTS/translate_locale_twin.py" \
      --base "$BASE" --locale "$LOC" --source-lang "$SRC" \
      --resume --sleep "$SLEEP" \
      >>"$LOGDIR/${fam}-${LOC}.log" 2>&1; then
    echo "[!] translate failed $BASE $LOC" | tee -a "$LOGDIR/orchestrator.log"
    fail_n=$((fail_n+1))
    continue
  fi
  CONTENT="$CLEAN/${fam}-${LOC}.content.json"
  # translate script names outputs by family-locale from base
  if [[ ! -f "$CONTENT" ]]; then
    # try alternate naming from script
    CONTENT="$CLEAN/${BASE%-es}-${LOC}.content.json"
  fi
  if [[ ! -f "$CONTENT" ]]; then
    echo "[!] missing content $CONTENT" | tee -a "$LOGDIR/orchestrator.log"
    fail_n=$((fail_n+1))
    continue
  fi
  if ! (cd "$SCRIPTS" && npx ts-node --transpile-only import_locale_twin.ts \
      --base "$BASE" --locale "$LOC" --file "$CONTENT") \
      >>"$LOGDIR/${fam}-${LOC}.import.log" 2>&1; then
    echo "[!] import failed $BASE $LOC" | tee -a "$LOGDIR/orchestrator.log"
    fail_n=$((fail_n+1))
    continue
  fi
  done_n=$((done_n+1))
  echo "[✓] $BASE → $LOC ($done_n done, $fail_n fail)" | tee -a "$LOGDIR/orchestrator.log"
done
echo "DONE done=$done_n fail=$fail_n" | tee -a "$LOGDIR/orchestrator.log"
