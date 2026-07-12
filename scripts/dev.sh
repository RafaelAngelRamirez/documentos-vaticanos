#!/usr/bin/env bash
# Local full-stack dev: Postgres + API + Angular in Docker.
# Usage: ./scripts/dev.sh   |  npm run dev  |  yarn dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-documentos-vaticanos}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev] docker no está instalado o no está en PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "[dev] se necesita 'docker compose' (plugin v2)" >&2
  exit 1
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME")

BUILD_FLAG=()
DETACH=(-d)
FOREGROUND=0
WAIT_SECS=90
SERVICES=(postgres api web)

for arg in "$@"; do
  case "$arg" in
    --build|-b) BUILD_FLAG=(--build) ;;
    -d|--detach) DETACH=(-d) ;;
    -f|--foreground)
      DETACH=()
      FOREGROUND=1
      ;;
    --api-only)
      SERVICES=(postgres api)
      ;;
    --down)
      echo "[dev] deteniendo stack…"
      "${COMPOSE[@]}" down
      exit 0
      ;;
    --logs)
      exec "${COMPOSE[@]}" logs -f "${SERVICES[@]}"
      ;;
    --status)
      "${COMPOSE[@]}" ps
      exit 0
      ;;
    --help|-h)
      cat <<EOF
Uso: yarn dev | npm run dev | ./scripts/dev.sh [opciones]

Levanta el stack de pruebas local con Docker Compose:
  postgres  :5432
  api       :3000  (DEV_AUTH_BYPASS=true)
  web       :4200  (ng serve)

Opciones:
  --build, -b       Rebuild de imágenes
  -d, --detach      Background (por defecto)
  -f, --foreground  Adjuntar logs en primer plano
  --api-only        Solo postgres + api (sin Angular)
  --down            Detener y salir
  --logs            Seguir logs
  --status          Estado de contenedores
  --help            Esta ayuda

Ejemplos:
  yarn dev
  yarn dev:build
  yarn dev:down
  yarn test:api          # con la API arriba

URLs:
  Web   http://localhost:4200
  API   http://localhost:3000/api/v1/health
  Login dev en /cuenta  (idToken: dev:email@example.com:Nombre)
EOF
      exit 0
      ;;
    *)
      echo "[dev] opción desconocida: $arg (usa --help)" >&2
      exit 1
      ;;
  esac
done

echo "[dev] compose: $COMPOSE_FILE (project=$PROJECT_NAME)"
echo "[dev] servicios: ${SERVICES[*]}"
echo "[dev] web → http://localhost:4200"
echo "[dev] api → http://localhost:3000/api/v1/health"
echo ""

if (( FOREGROUND )); then
  exec "${COMPOSE[@]}" up "${BUILD_FLAG[@]}" "${SERVICES[@]}"
fi

# angular.json / styles changes need a full web recreate (ng serve caches entry styles)
if ((${#BUILD_FLAG[@]})) || [[ "${DEV_RECREATE_WEB:-}" == "1" ]]; then
  echo "[dev] recreando contenedor web (estilos limpios)…"
  "${COMPOSE[@]}" up "${BUILD_FLAG[@]}" -d --force-recreate "${SERVICES[@]}"
else
  "${COMPOSE[@]}" up -d "${SERVICES[@]}"
fi

echo "[dev] esperando health de la API (hasta ${WAIT_SECS}s)…"
deadline=$((SECONDS + WAIT_SECS))
ok=0
while (( SECONDS < deadline )); do
  if curl -sf "http://127.0.0.1:3000/api/v1/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if (( ok )); then
  echo "[dev] API lista ✓  http://localhost:3000/api/v1/health"
else
  echo "[dev] la API aún no responde; revisa: yarn run dev -- --logs" >&2
  echo "[dev] o: docker compose -f $COMPOSE_FILE -p $PROJECT_NAME logs api" >&2
fi

if printf '%s\n' "${SERVICES[@]}" | grep -qx web; then
  echo "[dev] Angular (web) puede tardar en el primer npm install…"
  echo "[dev] Web → http://localhost:4200"
fi

echo ""
echo "[dev] stack en background. Comandos útiles:"
echo "  yarn dev:down          bajar todo"
echo "  yarn test:api          smoke API"
echo "  bash scripts/dev.sh --logs"
echo "  bash scripts/dev.sh --status"
