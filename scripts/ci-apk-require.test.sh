#!/usr/bin/env bash
# The n8n runner exports DV_REQUIRE_APK=1 and does not set DV_BUILD_APK.
# ${DV_REQUIRE_APK:-$DV_BUILD_APK} kept that 1 and collect failed with
# "DV_REQUIRE_APK=1 but APK missing". DV_BUILD_APK=0 is authoritative.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CI="$ROOT/.ci-build.sh"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$CI" ]] || fail "missing $CI"
if grep -E 'DV_REQUIRE_APK:-[^0]' "$CI" | grep -q .; then
  fail ".ci-build.sh still lets an inherited DV_REQUIRE_APK win (\${DV_REQUIRE_APK:-...})"
fi

fn="$(awk '/^apk_require_from_build\(\) \{/,/^\}/' "$CI")"
[[ -n "$fn" ]] || fail "apk_require_from_build() missing from .ci-build.sh"

resolve() {
  # Fresh shell. The caller passes the exact environment of one n8n case.
  env "$@" bash -c "${fn}"$'\n''apk_require_from_build; printf "%s %s\n" "$DV_BUILD_APK" "$DV_REQUIRE_APK"'
}

inherited="$(resolve -u DV_BUILD_APK DV_REQUIRE_APK=1)"
[[ "$inherited" == "0 0" ]] || fail "inherited DV_REQUIRE_APK=1 with unset DV_BUILD_APK resolved to '$inherited'"

explicit_off="$(resolve DV_BUILD_APK=0 DV_REQUIRE_APK=1)"
[[ "$explicit_off" == "0 0" ]] || fail "DV_BUILD_APK=0 with inherited require resolved to '$explicit_off'"

unset_both="$(resolve -u DV_BUILD_APK -u DV_REQUIRE_APK)"
[[ "$unset_both" == "0 0" ]] || fail "unset flags resolved to '$unset_both'"

on="$(resolve -u DV_REQUIRE_APK DV_BUILD_APK=1)"
[[ "$on" == "1 1" ]] || fail "DV_BUILD_APK=1 resolved to '$on'"

on_despite_zero="$(resolve DV_BUILD_APK=1 DV_REQUIRE_APK=0)"
[[ "$on_despite_zero" == "1 1" ]] || fail "DV_BUILD_APK=1 must keep the APK required, got '$on_despite_zero'"

echo "ci-apk-require.test.sh: ok"
