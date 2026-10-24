#!/usr/bin/env bash
# Recreate the docvat web container on the host (nginx-proxy + LE).
# Runs inside the build runner with docker.sock access.
set -euo pipefail

IMAGE="${DOCVAT_IMAGE:-${DOCKER_USERNAME:-legna37}/documentos-vaticanos:front-latest}"
NAME="${DOCVAT_CONTAINER_NAME:-docvat-web}"
VHOST="${DOCVAT_VIRTUAL_HOST:-docvat.codice-progressio.online}"
NETWORK="${DOCVAT_NETWORK:-codice-progressio_default}"
EMAIL="${DOCVAT_LE_EMAIL:-rafa.yael@gmail.com}"

echo "==> Deploy $NAME from $IMAGE on $VHOST (network $NETWORK)"

# Pull latest if we pushed (ignore failures for local-only images)
docker pull "$IMAGE" 2>/dev/null || true

# Stop/remove previous container (keep named for easy recreation)
if docker inspect "$NAME" >/dev/null 2>&1; then
  docker rm -f "$NAME" || true
fi

# Ensure network exists
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "ERROR: docker network $NETWORK not found" >&2
  docker network ls >&2 || true
  exit 1
fi

docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  --network "$NETWORK" \
  -e "VIRTUAL_HOST=$VHOST" \
  -e "VIRTUAL_PORT=80" \
  -e "LETSENCRYPT_HOST=$VHOST" \
  -e "LETSENCRYPT_EMAIL=$EMAIL" \
  "$IMAGE"

echo "==> Waiting for container health..."
sleep 3
docker inspect -f '{{.State.Status}}' "$NAME"
docker logs --tail 20 "$NAME" || true

echo "OK deployed https://$VHOST/"
