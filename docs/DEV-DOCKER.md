# Desarrollo local con Docker

## Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| postgres | 5432 | DB Fase 2 (`documentos` / `documentos`) |
| api | 3000 | Backend Express + Prisma (`DEV_AUTH_BYPASS=true`) |
| web | 4200 | Angular `ng serve` |
| e2e | — | Playwright (profile `e2e`) |

## Arranque

```bash
# desde la raíz del repo
docker compose -f docker-compose.dev.yml up --build
```

API health: http://localhost:3000/api/v1/health  
Web: http://localhost:4200  

Login local sin Google:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"dev:yo@example.com:Mi Nombre"}'
```

## Tests

```bash
# scrapers offline (fixtures)
npm run test:scrape

# API (con stack api+postgres arriba)
npm run test:api

# Playwright vía compose
docker compose -f docker-compose.dev.yml --profile e2e run --rm e2e
```

## Android

No hay emulador en Compose por defecto (requiere KVM y ~GB de imágenes).

Host:

```bash
cd frontend && npm run build:cap
cd android && ./gradlew assembleDebug
```

## Registro de documentos

Control de descargas en el repo:

`documentos/registry/downloaded-documents.json`

Se actualiza al correr `scrape_source` / `write_corpus` y `resolve_refs`.

## Variables útiles (api)

Ver `backend/.env.example`.
