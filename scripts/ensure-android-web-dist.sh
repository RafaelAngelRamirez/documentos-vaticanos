#!/usr/bin/env bash
# Rebuild frontend/dist when it is missing, has no reading packs, or was
# stamped with a different monorepo version. Sourced by package-apk.sh and
# package-aab.sh. Caller must define ROOT, FRONTEND, VERSION_NAME, and run().
# Sets DIST_WEB (global).

bundles_contain_version() {
  local f any=0
  for f in "$DIST_WEB"/*.js; do
    [[ -f "$f" ]] || continue
    any=1
    if grep -F -q -- "$VERSION_NAME" "$f"; then
      return 0
    fi
  done
  [[ "$any" == "1" ]] && return 1
  return 1
}

ensure_android_web_dist() {
  DIST_WEB="$FRONTEND/dist/documentos-vaticanos"
  local docs="$DIST_WEB/assets/corpus/documents"
  local stamp="$DIST_WEB/dv-build-version.txt"
  local stamped=""
  local rebuild=0
  local reason=""

  if [[ -f "$stamp" ]]; then
    stamped=$(tr -d '[:space:]' <"$stamp")
  fi
  if [[ ! -f "$DIST_WEB/index.html" ]]; then
    rebuild=1
    reason="missing index.html"
  elif [[ ! -d "$docs" ]]; then
    rebuild=1
    reason="stale web dist without reading packs"
  elif [[ "$stamped" != "$VERSION_NAME" ]]; then
    rebuild=1
    reason="web dist version '${stamped:-missing}' != $VERSION_NAME"
  elif ! bundles_contain_version; then
    rebuild=1
    reason="bundles do not contain version $VERSION_NAME"
  fi

  if [[ "$rebuild" == "1" ]]; then
    echo "==> $reason — rebuilding"
    rm -rf "$DIST_WEB"
    (
      cd "$FRONTEND"
      run npm run build
    )
  else
    echo "==> Reusing web dist stamped $VERSION_NAME"
  fi

  if [[ ! -f "$DIST_WEB/index.html" ]]; then
    echo "ERROR: missing $DIST_WEB/index.html after web build" >&2
    exit 1
  fi
  if ! bundles_contain_version; then
    echo "ERROR: production bundles do not contain version $VERSION_NAME" >&2
    exit 1
  fi
  printf '%s\n' "$VERSION_NAME" >"$stamp"
}
