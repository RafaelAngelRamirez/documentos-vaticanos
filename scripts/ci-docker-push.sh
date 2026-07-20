#!/usr/bin/env bash
# Build + push production front image (includes /downloads/* installers).
# Used by .ci-build.sh inside imperium-build-runner.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

gui_path="frontend"
docker_account="${DOCKER_USERNAME:-legna37}"
reference="$docker_account/documentos-vaticanos"
gui_v="v$(node -p "require('./frontend/package.json').version" 2>/dev/null || node -p "require('./package.json').version")"

imagen_frontend_latest="$reference:front-latest"
imagen_frontend_v="$reference:front-$gui_v"

echo "==> Ensuring production web dist exists"
if [[ ! -f "$gui_path/dist/documentos-vaticanos/index.html" ]]; then
  ( cd "$gui_path" && npm run build )
fi

# Downloads must already be collected into the web dist
if [[ ! -f "$gui_path/dist/documentos-vaticanos/downloads/manifest.json" ]]; then
  echo "WARN: no downloads/manifest.json — collecting if possible"
  bash "$ROOT/scripts/package-collect-downloads.sh" || true
fi

echo "==> Docker build $imagen_frontend_latest (context: $gui_path)"
docker build --progress=plain -t "$imagen_frontend_latest" "$gui_path"
docker tag "$imagen_frontend_latest" "$imagen_frontend_v"

if [[ -n "${DOCKER_TOKEN:-}" && -n "${DOCKER_USERNAME:-}" ]]; then
  echo "==> docker login + push"
  echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USERNAME" --password-stdin
  docker push "$imagen_frontend_latest"
  docker push "$imagen_frontend_v"
else
  echo "WARN: DOCKER_USERNAME/DOCKER_TOKEN unset — image built locally only"
fi

# Keep only the newest N version tags locally (plus front-latest). Old version
# tags bloat the host (each ~1–3G). Default retain 2; set DV_IMAGE_KEEP=0 to skip.
retain_local_image_tags() {
  local keep="${DV_IMAGE_KEEP:-2}"
  if [[ "$keep" == "0" ]]; then
    echo "==> image tag retention skipped (DV_IMAGE_KEEP=0)"
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi
  # List front-v* tags (not latest), newest first by CreatedAt when available
  local tags=()
  mapfile -t tags < <(
    docker images "$reference" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' 2>/dev/null \
      | grep -E ':front-v' \
      | sort -r \
      | cut -f2- \
      || true
  )
  if (( ${#tags[@]} <= keep )); then
    echo "==> image tags kept: ${#tags[@]} (≤ retain $keep)"
    return 0
  fi
  local i tag
  for ((i = keep; i < ${#tags[@]}; i++)); do
    tag="${tags[$i]}"
    # Never remove the tag we just built
    if [[ "$tag" == "$imagen_frontend_v" || "$tag" == "$imagen_frontend_latest" ]]; then
      continue
    fi
    echo "==> pruning old local image tag: $tag"
    docker rmi "$tag" 2>/dev/null || true
  done
}

retain_local_image_tags

echo "::DOCVAT_IMAGE::${imagen_frontend_latest}"
echo "OK images: $imagen_frontend_latest $imagen_frontend_v"
