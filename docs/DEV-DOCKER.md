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
# desde la raíz del repo (npm o yarn) — levanta postgres + api + web en Docker
yarn dev
# o
npm run dev

# rebuild imágenes
yarn dev:build

# solo API + Postgres (sin Angular)
yarn dev:api-only

# logs / estado / bajar
yarn dev:logs
yarn dev:status
yarn dev:down
```

El entrypoint es `scripts/dev.sh` (detach por defecto; espera health de la API).

| Script | Acción |
|--------|--------|
| `yarn dev` | `docker compose up -d` postgres, api, web |
| `yarn dev:build` | igual con `--build` |
| `yarn dev:api-only` | solo postgres + api |
| `yarn dev:down` | `compose down` |
| `yarn test:api` | smoke e2e del backend |

API health: http://localhost:3000/api/v1/health  
Web: http://localhost:4200  

Login local sin Google:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"dev:yo@example.com:Mi Nombre"}'
```

En la UI: **Cuenta** → login dev con `email` + nombre (backend `DEV_AUTH_BYPASS=true`).

### Voces Grok del narrador (opcional)

El narrador 5D puede ofrecer voces **Grok** (xAI TTS) cuando el API tiene clave:

```bash
# en el host, antes de yarn dev / yarn dev:api-only
export XAI_API_KEY=xai-...   # de https://console.x.ai — no es SuperGrok
yarn dev:api-only
```

- SuperGrok / SuperGrok Heavy **no** sustituyen `XAI_API_KEY` (API de pago aparte, ~$15/1M caracteres).
- Endpoints: `GET /api/v1/tts/voices`, `POST /api/v1/tts/speak` (proxy; la clave no va al browser).
- Sin clave: el narrador usa solo voces del sistema (Web Speech / Capacitor).
- Compose pasa `XAI_API_KEY` del host al servicio `api` si está exportada.
- En la app, **Ajustes → Narrador**: cada dispositivo activa/desactiva Grok y elige voz (`dv.narr.prefs.v1`); no es preferencia de cuenta.

## Tests

```bash
# scrapers offline (fixtures)
yarn test:scrape

# API (con stack api+postgres arriba)
yarn test:api

# Proxy TTS Grok + lógica del narrador (sin clave real; stubs de red)
yarn test:tts
yarn test:narrator-grok

# Playwright vía compose
yarn test:e2e
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
