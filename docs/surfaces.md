# Superficies y fronteras

Inventario del árbol en `master`. Una base web se empaqueta en tres cascarones. La API de cuenta es Express, sin contrato OpenAPI, GraphQL ni protobuf. El corpus no viaja por esa API.

El mapa de rutas de la app ya versionado está en [features/README.md](features/README.md). Los límites de capas están en [design/handoff/ARQUITECTURA.md](design/handoff/ARQUITECTURA.md). Los patrones que un agente no debe copiar están en [debt-hotspots.md](debt-hotspots.md).

## Superficies

| Superficie | Dónde | Qué ejecuta | Arranque |
| --- | --- | --- | --- |
| Web (Angular, también PWA) | `frontend/` | SPA en `frontend/src/`. Producción activa el service worker (`frontend/angular.json`, `frontend/ngsw-config.json`). | `yarn dev` → http://localhost:4200 |
| Android (Capacitor) | `frontend/android/` | El mismo `dist` web. `appId` `digital.documentosvaticanos.app`. `minSdk` 24, `compileSdk`/`targetSdk` 36 (`frontend/android/variables.gradle`). | `yarn dev:android` en un host con emulador y pantalla |
| Electron | `frontend/electron/` | El mismo `dist` web, servido en local por el proceso principal. | `yarn package:electron` |
| API | `backend/` | Express + Prisma + Postgres. Prefijo `/api/v1`. | `yarn dev` → http://localhost:3000/api/v1/health |
| Corpus (no es un servidor) | `scripts-descarga/` escribe `documentos/corpus/` | Herramientas offline. La app lee la copia de assets, no esta carpeta en caliente. | `bash scripts/corpus-sync-assets.sh` |

`package.json` (raíz) es quien publica los comandos `yarn`. El detalle de Docker está en [DEV-DOCKER.md](DEV-DOCKER.md). `scripts/dev.sh` es el entrypoint de `yarn dev`.

## Web

Angular 16. El router de producto está en `frontend/src/app/pages/pages-routing.module.ts`, colgado de `frontend/src/app/app-routing.module.ts`.

| Carpeta | Papel |
| --- | --- |
| `frontend/src/app/pages/` | Pantallas |
| `frontend/src/app/core/` | Lógica de dominio (corpus, cita, cuenta, búsqueda) |
| `frontend/src/app/services/` | Adaptadores de la app (navegación, prefs, sync HTTP) |
| `frontend/src/app/components/` | UI compartida, incluido el lector |
| `frontend/src/app/data/` | Catálogos estáticos de fichas |
| `frontend/src/styles.css` | Única hoja de la app |
| `frontend/src/assets/corpus/manifest.json` | Manifest de la copia que lee el lector |
| `frontend/src/environments/environment.ts` | `apiBaseUrl` en local: `http://localhost:3000/api/v1` |

La lectura, la búsqueda y las notas funcionan con el corpus empaquetado, sin cuenta y sin API. La cuenta, los estudios publicados y el merge de nube sí llaman a `/api/v1`.

Nginx de la imagen web (`frontend/nginx.conf`) hace `try_files` a `index.html`. El `ng serve` de `yarn dev` no es esa imagen: el fallback de rutas profundas está descrito en [DEV-DOCKER.md](DEV-DOCKER.md).

Comandos de esta superficie:

```bash
yarn dev
yarn dev:down
yarn dev:api-only
yarn package:web
```

## Android

Proyecto Capacitor en `frontend/android/`. La config web está en `frontend/capacitor.config.ts`: `webDir` `dist/documentos-vaticanos`, `appId` `digital.documentosvaticanos.app`. El recarga en vivo (`CAP_LIVE_RELOAD=1`) apunta al host del emulador y no entra en un APK de publicación.

`yarn dev:android` ejecuta `scripts/dev-android-emu.sh`. Ese script sale si no hay emulador en el SDK o si no hay `DISPLAY` ni `WAYLAND_DISPLAY`. El AVD por defecto es `medium_phone`.

Empaquetado de depuración, desde la raíz:

```bash
yarn package:apk
```

El `applicationId` y las versiones que firma el paquete salen de propiedades Gradle (`dvApplicationId`, `dvVersionCode`, `dvVersionName`) en `frontend/android/app/build.gradle`. Los secretos de firma no están en el repositorio.

## Electron

`frontend/electron/main.js` abre una ventana y sirve el build con `frontend/electron/static-server.js`. `frontend/electron/paths.js` resuelve el directorio `dist/documentos-vaticanos` bajo `frontend/`. `frontend/electron/preload.js` expone `documentosVaticanosShell` (`kind: 'electron'` y `openExternal`). El renderer no recibe Node.

```bash
yarn package:electron
```

`scripts/package-electron.sh` construye ese directorio si falta el `index.html` de producción. En `frontend/package.json`, `npm run electron` abre el shell y `npm run electron:smoke` lo cierra solo.

## API

`backend/src/index.ts` monta un `Router` en `/api/v1` y sirve ficheros subidos en `/uploads`. `GET /` responde JSON con `docs` apuntando a `/api/v1/health`. No hay archivo OpenAPI, GraphQL ni protobuf en el repo: el contrato es el código de `backend/src/routes/` más `backend/prisma/schema.prisma`.

Postgres entra por `DATABASE_URL`. El ejemplo de variables está en `backend/.env.example`. `yarn dev` levanta Postgres 15, la API y Angular según `docker-compose.dev.yml`, con `DEV_AUTH_BYPASS=true`.

Rutas registradas, todas bajo `/api/v1`:

| Método y ruta | Archivo |
| --- | --- |
| `GET /health` | `backend/src/routes/health.ts` |
| `POST /auth/google`, `POST /auth/refresh`, `POST /auth/logout` | `backend/src/routes/auth.ts` |
| `GET /me`, `POST /upgrade-teacher` | `backend/src/routes/me.ts` |
| `GET\|POST /me/references`, `DELETE /me/references/:id` | `backend/src/routes/references.ts` |
| `GET\|POST\|PATCH\|DELETE /me/themes`, `GET /me/themes/:id`, `PUT /me/themes/:id/steps`, `POST /me/themes/:id/submit`, `POST /me/themes/:id/make-private`, `POST /me/themes/:id/download` | `backend/src/routes/themes.ts` |
| `GET /admin/themes`, `GET /admin/themes/:id`, `POST /admin/themes/:id/review` | `backend/src/routes/themes.ts` |
| `POST /sync/merge` | `backend/src/routes/sync.ts` |
| `GET /studies`, `GET /studies/:id`, `POST /studies`, `PATCH /studies/:id`, `PUT /studies/:id/steps`, `POST /studies/:id/publish`, `POST /studies/:id/archive`, `DELETE /studies/:id`, `POST /studies/:id/enroll`, `GET /studies/:id/students`, `GET /me/studies`, `GET /me/enrollments` | `backend/src/routes/studies.ts` |
| `POST /uploads/image` | `backend/src/routes/uploads.ts` |

Modelos Prisma: `User`, `RefreshToken`, `PersonalReference`, `Theme`, `ThemeStep`, `Study`, `StudyStep`, `Enrollment`, `Anotacion`. Ninguno guarda el texto del corpus.

Smoke de la API, con el stack de `yarn dev` en marcha:

```bash
yarn test:api
```

Eso es `node e2e/api-e2e.mjs` contra `http://127.0.0.1:3000`.

## Corpus y scripts-descarga

`scripts-descarga/` baja, parsea y empaqueta el corpus. No es un proceso de la app. La guía de esa carpeta es `scripts-descarga/README.md`. El registro de fuentes está en `scripts-descarga/config/sources.json`.

| Papel | Ruta |
| --- | --- |
| Pack canónico | `documentos/corpus/` |
| Copia que empaqueta la app | `frontend/src/assets/corpus/` |
| Cuerpos generados, fuera de git | `.gitignore` ignora `documents/` bajo `frontend/src/assets/corpus/` |
| Quién copia | `scripts/corpus-sync-assets.sh` |

`yarn dev` sincroniza esa copia antes de servir. Quien edite un cuerpo lo hace en `documentos/corpus/`, no en `frontend/src/assets/corpus/`.

## Fronteras

1. El texto del corpus no entra en Express ni en Postgres. Lo leen `frontend/src/app/core/corpus/` y los cascarones que empaquetan el `dist`.
2. Los tres cascarones cargan el mismo `dist`. No hay una segunda UI en `frontend/android/` ni en `frontend/electron/`.
3. La sesión, los temas publicados, los estudios, las referencias de nube y el merge viven en `/api/v1`. El lector anónimo no los necesita.
4. `scripts-descarga/` escribe el pack. La app no descarga las fuentes del corpus en tiempo de lectura.
5. La verificación de una ruta web empaquetada es `.cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs`. El puerto de esa skill es `4219`, distinto del `4200` de `yarn dev`.

## Arranque que este archivo deja escrito

`AGENTS.md` nombra `yarn dev` y `yarn test:api`. Android y Electron están aquí y en [DEV-DOCKER.md](DEV-DOCKER.md) para no duplicar el runbook dentro de `AGENTS.md` en este cambio.
