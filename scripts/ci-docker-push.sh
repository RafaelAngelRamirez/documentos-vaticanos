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

echo "::DOCVAT_IMAGE::${imagen_frontend_latest}"
echo "OK images: $imagen_frontend_latest $imagen_frontend_v"
