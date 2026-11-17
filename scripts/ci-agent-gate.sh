#!/usr/bin/env bash
# Agent gate: feature-map check, yarn run check, evidence policy, lector drive.
#
# check-map is required from scripts/ci-cheap.sh, which .ci-build.sh already
# runs. `yarn run check` (scripts/check.mjs: typecheck, cheap tests, ESLint)
# is required here and in the pull-request workflow. Never call `yarn check`:
# Yarn 1 uses that name for its lockfile builtin.
#
# .ci-build.sh runs this whole script only when DV_AGENT_GATE=1. Leave that
# off on the n8n runner. The default entry already has check-map; the lector
# drive still needs a packaged web tree, and this block stays off that path.
#
# Default required steps for `all` are map, check, and evidence. Lector is
# required only when DV_AGENT_GATE_REQUIRE lists `lector`. The pull-request
# workflow calls `lector` and `mobile` as their own steps; both fail that job.
# `mobile` is Playwright project mobile-390 (lector + biblioteca, 390×844).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERIFY=(node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs)
MAP=(node .cursor/skills/verify-documentos-vaticanos/scripts/check-map.mjs)

usage() {
  echo "usage: ci-agent-gate.sh [all|map|check|evidence|lector|mobile]" >&2
  exit 2
}

run_map() {
  echo "==> check-map"
  set +e
  "${MAP[@]}"
  local ec=$?
  echo "exit check-map ${ec}"
  return "$ec"
}

pick_chromium() {
  if [[ -n "${DV_VERIFY_CHROMIUM:-}" ]]; then
    return 0
  fi
  if [[ -x /usr/bin/chromium ]]; then
    export DV_VERIFY_CHROMIUM=/usr/bin/chromium
  elif [[ -x /usr/bin/chromium-browser ]]; then
    export DV_VERIFY_CHROMIUM=/usr/bin/chromium-browser
  elif [[ -x /usr/local/bin/google-chrome ]]; then
    export DV_VERIFY_CHROMIUM=/usr/local/bin/google-chrome
  elif [[ -x /usr/bin/google-chrome ]]; then
    export DV_VERIFY_CHROMIUM=/usr/bin/google-chrome
  fi
}

ensure_playwright() {
  if [[ -d "$ROOT/e2e/node_modules/playwright" ]]; then
    return 0
  fi
  echo "==> npm ci e2e"
  npm ci --prefix "$ROOT/e2e"
}

ensure_browser() {
  pick_chromium
  if [[ -n "${DV_VERIFY_CHROMIUM:-}" && -x "${DV_VERIFY_CHROMIUM}" ]]; then
    return 0
  fi
  unset DV_VERIFY_CHROMIUM
  echo "==> playwright install chromium"
  (cd "$ROOT/e2e" && npx playwright install chromium)
  local bin
  bin="$(
    cd "$ROOT/e2e" &&
      node -e 'const {chromium}=require("playwright"); process.stdout.write(chromium.executablePath())'
  )"
  if [[ ! -x "$bin" ]]; then
    echo "browser fail missing ${bin}" >&2
    return 1
  fi
  export DV_VERIFY_CHROMIUM="$bin"
}

reader_dist() {
  if [[ -n "${DV_VERIFY_DIST:-}" && -f "${DV_VERIFY_DIST}/index.html" ]]; then
    printf '%s\n' "$DV_VERIFY_DIST"
    return 0
  fi
  local dir
  for dir in "$ROOT/frontend/dist/documentos-vaticanos" "$ROOT/dist/web"; do
    if [[ -f "$dir/index.html" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
  done
  return 1
}

# The packaged tree does not vendor document bodies (assets/corpus/documents
# is gitignored). Copy cic-es from the canonical corpus into that dist so the
# reader can mount app-punto. The canonical files are not modified.
seed_doc() {
  local id="$1"
  local dist src dest
  dist="$(reader_dist)" || {
    echo "seed fail missing packaged index.html" >&2
    return 1
  }
  src="$ROOT/documentos/corpus/documents/$id"
  dest="$dist/assets/corpus/documents/$id"
  if [[ ! -f "$src/content.json" || ! -f "$src/index.json" ]]; then
    echo "seed fail missing $src" >&2
    return 1
  fi
  mkdir -p "$dest"
  cp -a "$src/." "$dest/"
  echo "==> seeded $id → $dest"
}

seed_cic() {
  seed_doc cic-es
}

drive_lector() {
  echo "==> lector drive"
  pick_chromium
  local ec=0
  set +e
  "${VERIFY[@]}" launch
  ec=$?
  if [[ "$ec" -eq 0 ]]; then
    "${VERIFY[@]}" doctor
    ec=$?
  fi
  if [[ "$ec" -eq 0 ]]; then
    "${VERIFY[@]}" drive lector
    ec=$?
  fi
  "${VERIFY[@]}" cleanup
  local cleanup_ec=$?
  if [[ "$ec" -eq 0 ]]; then
    ec=$cleanup_ec
  fi
  echo "exit lector ${ec}"
  return "$ec"
}

# Pull-request step. `all` keeps drive_lector without this prep so the n8n
# opt-in (DV_AGENT_GATE=1) does not install a browser.
run_lector() {
  ensure_playwright
  ensure_browser
  seed_cic
  drive_lector
}

run_check() {
  echo "==> yarn run check"
  set +e
  yarn run check
  local ec=$?
  echo "exit yarn-run-check ${ec}"
  return "$ec"
}

run_evidence() {
  echo "==> evidence policy"
  set +e
  node scripts/ci-evidence-policy.mjs
  local ec=$?
  echo "exit evidence ${ec}"
  return "$ec"
}

run_mobile() {
  echo "==> mobile-390"
  ensure_playwright
  ensure_browser
  seed_cic
  seed_doc lg-es
  local dist port srv ec ready
  dist="$(reader_dist)"
  port="${E2E_PORT:-4173}"
  node "$ROOT/e2e/spa-static.js" "$dist" "$port" &
  srv=$!
  stop_srv() {
    if [[ -n "${srv:-}" ]]; then
      kill "$srv" 2>/dev/null || true
      wait "$srv" 2>/dev/null || true
      srv=
    fi
  }
  ready=0
  local _
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null; then
      ready=1
      break
    fi
    sleep 0.25
  done
  if [[ "$ready" -ne 1 ]]; then
    stop_srv
    echo "mobile fail server http://127.0.0.1:${port}" >&2
    return 1
  fi
  local probe
  probe="$(mktemp)"
  if ! curl -sf "http://127.0.0.1:${port}/assets/corpus/documents/cic-es/content.json" -o "$probe"; then
    rm -f "$probe"
    stop_srv
    echo "mobile fail cic-es content" >&2
    return 1
  fi
  if [[ "$(head -c 1 "$probe")" != "[" ]]; then
    rm -f "$probe"
    stop_srv
    echo "mobile fail cic-es content is not json" >&2
    return 1
  fi
  rm -f "$probe"
  set +e
  (
    cd "$ROOT/e2e"
    E2E_BASE_URL="http://127.0.0.1:${port}" \
      E2E_START_WEB= \
      npx playwright test --project=mobile-390 --reporter=list
  )
  ec=$?
  set -e
  stop_srv
  echo "exit mobile-390 ${ec}"
  return "$ec"
}

cmd="${1:-all}"
case "$cmd" in
  map)
    run_map
    exit $?
    ;;
  check)
    run_check
    exit $?
    ;;
  evidence)
    run_evidence
    exit $?
    ;;
  lector)
    run_lector
    exit $?
    ;;
  mobile)
    run_mobile
    exit $?
    ;;
  all)
    set +e
    run_map
    map_ec=$?
    run_check
    check_ec=$?
    drive_lector
    lector_ec=$?
    if [[ "$lector_ec" -eq 0 ]]; then
      if [[ -n "${DV_EVIDENCE_REGENERATED:-}" ]]; then
        export DV_EVIDENCE_REGENERATED="${DV_EVIDENCE_REGENERATED},lector"
      else
        export DV_EVIDENCE_REGENERATED=lector
      fi
    fi
    run_evidence
    evidence_ec=$?
    set -e
    echo "summary check-map ${map_ec} yarn-run-check ${check_ec} lector ${lector_ec} evidence ${evidence_ec}"
    require="${DV_AGENT_GATE_REQUIRE:-map,check,evidence}"
    ec=0
    IFS=',' read -ra parts <<< "$require"
    for part in "${parts[@]}"; do
      case "$part" in
        map) [[ "$map_ec" -eq 0 ]] || ec=1 ;;
        check) [[ "$check_ec" -eq 0 ]] || ec=1 ;;
        evidence) [[ "$evidence_ec" -eq 0 ]] || ec=1 ;;
        lector) [[ "$lector_ec" -eq 0 ]] || ec=1 ;;
        "") ;;
        *)
          echo "unknown require step ${part}" >&2
          ec=1
          ;;
      esac
    done
    exit "$ec"
    ;;
  *) usage ;;
esac
