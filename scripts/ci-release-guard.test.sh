#!/usr/bin/env bash
# Cheap proof for scripts/ci-release-guard.sh.
# Uses a throwaway bare remote. Does not touch the repo's origin, and does
# not delete or move any tag outside that temp remote.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GUARD="$ROOT/scripts/ci-release-guard.sh"
CI="$ROOT/.ci-build.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -x "$GUARD" || -f "$GUARD" ]] || fail "missing $GUARD"
grep -q 'bash scripts/ci-release-guard.sh' "$CI" || fail ".ci-build.sh does not call the guard"
if grep -E '^[[:space:]]*npx --yes standard-version' "$CI" >/dev/null; then
  fail ".ci-build.sh still invokes standard-version itself"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
origin="$tmp/origin.git"
work="$tmp/work"
other="$tmp/other"
marker="$tmp/cutter-ran"
cutter="$tmp/cutter.sh"

git init --bare -b master "$origin" >/dev/null
git clone "$origin" "$work" >/dev/null 2>&1
git -C "$work" config user.name "release-guard-test"
git -C "$work" config user.email "release-guard-test@example.com"
git -C "$work" checkout -B master
printf '%s\n' '{' '  "version": "0.0.36"' '}' > "$work/package.json"
git -C "$work" add package.json
git -C "$work" commit -m "feat: base" >/dev/null
git -C "$work" push -u origin master >/dev/null

cat > "$cutter" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo cut > "$DV_CUT_MARKER"
git commit --allow-empty -m "chore(release): should-not"
git tag -a "$DV_NEXT_TAG" -m "chore(release): should-not"
EOF
chmod +x "$cutter"

run_guard() {
  local expected="$1"
  local code=0
  set +e
  (
    cd "$work"
    DV_RELEASE_REMOTE=origin \
    DV_RELEASE_BRANCH=master \
    DV_CUT_MARKER="$marker" \
    DV_RELEASE_CUTTER="$cutter" \
    DV_NEXT_TAG="$DV_NEXT_TAG" \
      bash "$GUARD"
  )
  code=$?
  set -e
  [[ "$code" == "$expected" ]] || fail "expected exit ${expected}, got ${code} (DV_NEXT_TAG=${DV_NEXT_TAG})"
}

snapshot() {
  snap_head="$(git -C "$work" rev-parse HEAD)"
  snap_commits="$(git -C "$work" rev-list --count HEAD)"
  snap_tags="$(git -C "$work" tag --list | sort | tr '\n' ' ')"
  snap_origin_master="$(git -C "$origin" rev-parse refs/heads/master)"
  snap_origin_tags="$( { git -C "$origin" show-ref --tags || true; } | awk '{print $2}' | sort | tr '\n' ' ')"
}

assert_unchanged() {
  local now_head now_commits now_tags now_origin now_origin_tags
  now_head="$(git -C "$work" rev-parse HEAD)"
  now_commits="$(git -C "$work" rev-list --count HEAD)"
  now_tags="$(git -C "$work" tag --list | sort | tr '\n' ' ')"
  now_origin="$(git -C "$origin" rev-parse refs/heads/master)"
  now_origin_tags="$( { git -C "$origin" show-ref --tags || true; } | awk '{print $2}' | sort | tr '\n' ' ')"
  [[ "$now_head" == "$snap_head" ]] || fail "HEAD moved"
  [[ "$now_commits" == "$snap_commits" ]] || fail "commit count changed"
  [[ "$now_tags" == "$snap_tags" ]] || fail "local tags changed (${snap_tags} -> ${now_tags})"
  [[ "$now_origin" == "$snap_origin_master" ]] || fail "origin/master moved"
  [[ "$now_origin_tags" == "$snap_origin_tags" ]] || fail "origin tags changed"
  [[ ! -e "$marker" ]] || fail "cutter ran"
  [[ -z "$(git -C "$work" status --porcelain)" ]] || fail "worktree dirty"
}

echo "== tag already on origin: exit without a release commit or tag =="
rm -f "$marker"
git clone "$origin" "$other" >/dev/null 2>&1
git -C "$other" config user.name "release-guard-test"
git -C "$other" config user.email "release-guard-test@example.com"
git -C "$other" tag -a v0.0.37 -m "chore(release): 0.0.37"
git -C "$other" push origin refs/tags/v0.0.37 >/dev/null
git -C "$work" rev-parse --verify --quiet refs/tags/v0.0.37 >/dev/null && fail "work clone should not have the tag yet"
snapshot
DV_NEXT_TAG=v0.0.37 run_guard 2
assert_unchanged
echo "ok: tag exists, no new commit, no new tag, cutter not called"

echo "== SHA is not origin/master: do not cut =="
rm -f "$marker"
git -C "$other" commit --allow-empty -m "feat: later on master" >/dev/null
git -C "$other" push origin HEAD:master >/dev/null
work_before="$(git -C "$work" rev-parse HEAD)"
origin_tip="$(git -C "$origin" rev-parse refs/heads/master)"
[[ "$work_before" != "$origin_tip" ]] || fail "fixture did not move the tip"
snapshot
DV_NEXT_TAG=v0.0.38 run_guard 3
assert_unchanged
git -C "$work" rev-parse --verify --quiet refs/tags/v0.0.38 >/dev/null && fail "refused cut still created v0.0.38"
echo "ok: stale SHA, no release"

echo "== tip and free tag: cutter may run =="
rm -f "$marker"
git -C "$work" fetch --no-tags origin master >/dev/null
git -C "$work" merge --ff-only origin/master >/dev/null
[[ "$(git -C "$work" rev-parse HEAD)" == "$(git -C "$origin" rev-parse refs/heads/master)" ]] || fail "work is not the tip"
before_commits="$(git -C "$work" rev-list --count HEAD)"
origin_before="$(git -C "$origin" rev-parse refs/heads/master)"
DV_NEXT_TAG=v0.0.38 run_guard 0
[[ -e "$marker" ]] || fail "cutter did not run when the cut was allowed"
after_commits="$(git -C "$work" rev-list --count HEAD)"
[[ "$after_commits" == "$((before_commits + 1))" ]] || fail "allowed cut did not create exactly one commit"
git -C "$work" rev-parse --verify --quiet refs/tags/v0.0.38 >/dev/null || fail "allowed cut did not create the tag"
[[ "$(git -C "$origin" rev-parse refs/heads/master)" == "$origin_before" ]] || fail "allowed cut pushed master"
git -C "$origin" rev-parse --verify --quiet refs/tags/v0.0.38 >/dev/null && fail "allowed cut pushed the tag"
echo "ok: allowed cut stays local to the clone"

echo "ci-release-guard.test.sh: ok"
