# AGENTS.md — Documentos Vaticanos

Lector católico offline. El corpus va empaquetado: se lee, se busca y se anota sin cuenta y sin red. El foco es la app móvil Android (Capacitor, `frontend/android`, id `digital.documentosvaticanos.app`). La misma base web también se empaqueta como PWA y como Electron.

## Pirámide

Cada corrección se empuja lo más arriba posible. El plan por etapas está en `docs/agent-readiness-plan.md` (entra con el PR #52).

1. Arquitectura y código. Una implementación canónica. El estado ilegal no se puede expresar.
2. Análisis estático y CI. El rechazo es mecánico y el mensaje dice qué usar.
3. Instrucciones y skills. El mínimo para encontrar el camino: este archivo, el mapa y la skill de verificación.
4. Revisión humana. Último recurso: muestreo.

Muestreo y corte: `docs/gardening.md` y `docs/agent-metrics.md`.

El patrón que se extiende está en `docs/debt-hotspots.md` (mismo PR #52), en el apartado Canónico. El apartado Prohibido se deja quieto.

## Arranque por superficie

Desde la raíz. Solo comandos que ya están en `package.json` o en `scripts/`.

| Superficie | Comando | Qué corre |
| --- | --- | --- |
| Web y API | `yarn dev` | `bash scripts/dev.sh`. Postgres, API y Angular (Docker Compose). |
| Solo API | `yarn dev:api-only` | `bash scripts/dev.sh --api-only`. Postgres y API. |
| API en el host | `yarn dev:api` | `npm --prefix backend run dev` (`tsx watch src/index.ts`). |
| Bajar el stack | `yarn dev:down` | `bash scripts/dev.sh --down`. |
| Android | `yarn dev:android` | `bash scripts/dev-android-emu.sh`. Emulador, `ng serve` y el último APK de depuración. |
| Electron | `yarn package:electron` | `bash scripts/package-electron.sh`. Empaqueta; no hay script de desarrollo en vivo en la raíz. |

- Web: http://localhost:4200
- API: http://localhost:3000/api/v1/health

`yarn dev` deja `DEV_AUTH_BYPASS` activo. Puertos y flags: `docs/DEV-DOCKER.md`. Hace falta Docker. `scripts/dev.sh --help` lista `--build`, `--api-only`, `--down`, `--logs`, `--status` y `--help`; el chequeo de Docker corre antes que `--help`.

Android exige el emulador del SDK, `adb` y `DISPLAY` o `WAYLAND_DISPLAY`. El AVD por defecto es `medium_phone` (`DV_AVD`). El script no tiene `--help` ni `--dry-run`.

Electron en la raíz es el empaquetado. `DV_ELECTRON_TARGETS` (default `linux,win`). Con el `dist` web ya construido, `frontend/package.json` tiene `electron` (`electron .`) y `electron:smoke`. Esos dos arrancan el proceso local. El empaquetado de escritorio sigue siendo `yarn package:electron`. Ninguno de los tres define `--dry-run`.

## Verificación

Con la API de `yarn dev` en marcha:

```bash
yarn test:api
```

Es `node e2e/api-e2e.mjs`. Habla con `http://127.0.0.1:3000` (o `E2E_API_URL`) y usa el `DEV_AUTH_BYPASS` del stack. El script no define `--help` ni `--dry-run`.

La skill de la SPA empaquetada es `.cursor/skills/verify-documentos-vaticanos/`. Desde la raíz:

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs launch
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs doctor
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs cleanup
```

Sin subcomando imprime `usage: dv-verify.mjs launch|doctor|drive <feature>|cleanup` y sale 2. `drive <feature>` usa el id de una ficha del mapa. La prueba de lector es `drive lector`. Cada drive escribe `.cursor/skills/verify-documentos-vaticanos/evidence/<feature>.txt`. `cleanup` para el pid de esta skill y no borra `evidence/`.

Launch está listo cuando la salida trae `launch ready` y `doctor ok`. El servidor por defecto es `http://127.0.0.1:4219` sobre el `dist` empaquetado. `yarn dev` (puerto 4200) se adopta solo si la ficha necesita cuenta o sync; no se levanta un segundo servidor en 4219.

## Gate

Una tarea queda terminada cuando la skill de verificación del flujo tocado ha corrido y la evidencia va en el PR. En una ruta de la SPA eso es Launch, Doctor, Drive de la ficha, el `evidence/<feature>.txt` y Cleanup. En la API de cuenta es la salida de `yarn test:api` con el stack arriba. El typecheck no basta. Si la verificación falla por un patrón de `docs/debt-hotspots.md`, se informa y se sube la corrección en la pirámide.

## Mapa y memoria

El mapa canónico ya está en `master`:

`.cursor/skills/verify-documentos-vaticanos/features/`

Se lee `features/README.md` y después una sola ficha: cómo llegar, cómo conducirla con `dv-verify` y qué cuenta como evidencia.

Estos documentos entran con el [#52](https://github.com/RafaelAngelRamirez/documentos-vaticanos/pull/52) (rama `cursor/bloque-a-memoria-base-4758`). Aquí solo se enlazan:

| Ruta | Para qué |
| --- | --- |
| `docs/surfaces.md` | Superficies, fronteras y arranque |
| `docs/debt-hotspots.md` | Patrón canónico y patrón prohibido |
| `docs/features/README.md` | Declara canónico el mapa del skill |
| `docs/agent-readiness-plan.md` | Plan de las etapas |
| `docs/design/handoff/ARQUITECTURA.md` | Capas y qué no se cruza |

La arquitectura que hay que leer es `docs/design/handoff/ARQUITECTURA.md`. Ese archivo describe el árbol actual.

## Flujo

1. Investigar en el mapa: el índice y la ficha de la feature. Los límites de capa, en la arquitectura del #52.
2. Implementar el patrón canónico de `docs/debt-hotspots.md`.
3. Verificar con la skill y adjuntar la evidencia.
4. PR pequeño, una tarea, contra `master`.

Un refactor que mueve una ruta, un selector o el modo de llegar a la pantalla actualiza la ficha tocada en `.cursor/skills/verify-documentos-vaticanos/features/` dentro del mismo PR. El checklist está en `docs/agent-workflow.md`. El primer día de un agente está en `.cursor/skills/onboard-documentos-vaticanos/`.

## Dónde vive cada cosa

| Ruta | Qué es |
| --- | --- |
| `frontend/` | App Angular, Capacitor (`frontend/android`) y Electron (`frontend/electron`) |
| `backend/` | API Express + Prisma (`/api/v1`) |
| `scripts-descarga/` | Scrapers de vatican.va y herramientas del corpus |
| `.cursor/skills/verify-documentos-vaticanos/` | Skill que abre el lector web empaquetado y comprueba una ruta |
| `.cursor/skills/onboard-documentos-vaticanos/` | Checklist de entrada: mapa, arquitectura y `dv-verify` |
| `docs/agent-workflow.md` | Secuencia investigar → canónico → evidencia → PR |

## Skills

Las skills de este repo son `build-documentos-vaticanos`, `release-documentos-vaticanos`, `n8n-documentos-vaticanos`, `verify-documentos-vaticanos` y el onboarding. Investigar, planificar, corregir y describir la arquitectura se leen en el mapa, en los docs del #52 y en `docs/agent-workflow.md`. No hay una skill aparte para cada una de esas cuatro.

## Ramas

`master` es la rama principal. Una tarea por pull request. Sin force-push. No borrar ramas.

## Build

El build de n8n de Documentos Vaticanos espera a Imperium y no se modifica desde este repo. Empaquetar en local es la skill `build-documentos-vaticanos`. La cola es `n8n-documentos-vaticanos`. El corte de versión es `release-documentos-vaticanos`.
