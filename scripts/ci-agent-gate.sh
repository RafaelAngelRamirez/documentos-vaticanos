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
# required only when DV_AGENT_GATE_REQUIRE lists `lector`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERIFY=(node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs)
MAP=(node .cursor/skills/verify-documentos-vaticanos/scripts/check-map.mjs)

usage() {
  echo "usage: ci-agent-gate.sh [all|map|check|evidence|lector]" >&2
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
  fi
}

run_lector() {
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
  all)
    set +e
    run_map
    map_ec=$?
    run_check
    check_ec=$?
    run_lector
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
