# Arquitectura mínima

Límites del árbol actual. El texto anterior de este archivo (un `documentos.js`, claves `dv.settings` / `dv.nav` / `dv.pos.*`, `appId` `dev.munin.documentosvaticanos`, tipografías remotas) no describe el código. Esas claves no se leen en `frontend/src`.

El inventario de superficies está en [../../surfaces.md](../../surfaces.md). Los patrones que no se copian están en [../../debt-hotspots.md](../../debt-hotspots.md).

## Capas

```text
scripts-descarga/  →  documentos/corpus/  →  frontend/src/assets/corpus/  →  dist web
                                                              │
                                                              ▼
                                                    Angular (única UI)
                                                              │
                          ┌───────────────────────────────────┼────────────────────────┐
                          ▼                                   ▼                        ▼
                     PWA (ngsw)                    Capacitor Android              Electron
                     frontend/ngsw-config.json     frontend/android/            frontend/electron/

Angular  --cuenta y merge-->  Express /api/v1  →  Postgres (Prisma)
```

| Capa | Ruta | Cruza hacia |
| --- | --- | --- |
| Corpus canónico | `documentos/corpus/` | La copia de ship, vía `scripts/corpus-sync-assets.sh` |
| Herramientas del corpus | `scripts-descarga/` | Solo el pack canónico. No importa Angular ni Express |
| App | `frontend/src/` | Assets locales y, si hay sesión, `/api/v1` |
| Cascarón Android | `frontend/android/` | El `dist` indicado en `frontend/capacitor.config.ts` (`webDir`: `dist/documentos-vaticanos`) |
| Cascarón Electron | `frontend/electron/` | El mismo `dist`, resuelto en `frontend/electron/paths.js` |
| API | `backend/src/index.ts` | Postgres. No lee `documentos/corpus/` |
| Datos de cuenta | `backend/prisma/schema.prisma` | Usuario, tokens, referencias, temas, estudios, anotaciones de nube |

`appId` de los dos cascarones nativos: `digital.documentosvaticanos.app`.

## Qué no cruza

- El texto de una obra no se guarda en Prisma ni se añade como ruta Express. El lector lo toma del manifest y de los JSON de `frontend/src/assets/corpus/`.
- Android y Electron no tienen otra pantalla. Un cambio de UI es un cambio de Angular. El puente nativo queda en el servicio que ya habla con Capacitor, o en `frontend/electron/preload.js` (`documentosVaticanosShell`).
- `scripts-descarga/` no se llama desde una pantalla. Quien añade una obra sigue el flujo de esa carpeta y sincroniza assets.
- La dirección de lectura no se inventa en la ruta a mano. Sale de `frontend/src/app/core/reading/cite.ts` por `NavigationService.openReading`: `/leyendo/:documentId/u/:unitIndex`.
- La hoja de la app es `frontend/src/styles.css`. Los campos de `DocumentMeta` se mantienen iguales en el modelo del corpus, en `frontend/src/app/core/corpus/corpus.models.ts` y en `frontend/src/app/core/corpus/corpus-load.logic.ts`.

## Estado en el cliente

La lectura guarda prefs y marcas en `localStorage` con las claves de [../../debt-hotspots.md](../../debt-hotspots.md) (sección 9). `reader.prefs.v1` es la de lectura. `dv.lastRead` es la tarjeta para continuar. El diario local está en `frontend/src/app/core/sync/sync-journal.service.ts`; el merge HTTP está en `frontend/src/app/services/sync.service.ts` y no sustituye al diario.

La API hace falta para la sesión, el merge, las referencias de nube, los temas publicados y los estudios. El lector anónimo no la arranca.
