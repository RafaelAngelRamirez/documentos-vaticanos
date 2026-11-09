# Hotspots que un agente copiaría

Lista corta, leída en el árbol actual. Cada fila es un patrón visible al lado de código nuevo. El camino canónico es el que hay que extender. El prohibido es el que hay que dejar de copiar.

La cita de producto es `documentId` + `unitIndex`. El tipo vive en `frontend/src/app/core/reading/cite.ts`.

## 1. Entrar al lector

Canónico. `NavigationService.openReading` (`frontend/src/app/services/navigation.service.ts`) es la única puerta. Arma la URL con `readingCommands`: `/leyendo/:documentId/u/:unitIndex`. `parseDocumentId` y `parseUnitIndex` rechazan un título, un `shortTitle` o un consecutivo con letras. `matchesPackId` compara solo el id del pack.

Prohibido. Navegar a mano a `/leyendo/:id/punto/:user`, guardar `document_id`, `article_selected` o `actual_index`, o tratar el `consecutivo` (`Gn 1`, `LG 16`, `27`) como dirección. Esas tres claves están en `LEGACY_READING_KEYS` y `clearLegacyReadingKeys` las borra. La ruta `punto` sigue montada en `frontend/src/app/pages/pages-routing.module.ts` para que `parseArrival` redirija; no es una puerta nueva. `frontend/src/app/components/lector/lector.component.ts` llama a `parseArrival`.

`docs/diseno-cursor-lectura.md` propone la forma. El código de `cite.ts` y `openReading` ya es la dirección. Si el texto de esa propuesta y el código discrepan, manda el código.

## 2. Dónde vive el corpus

Canónico. Se edita `documentos/corpus/`. `scripts/corpus-sync-assets.sh` copia el subconjunto de ship a `frontend/src/assets/corpus/`. La app lee esa copia con `frontend/src/app/core/corpus/corpus.service.ts` y `frontend/src/app/core/corpus/corpus-load.logic.ts`. `.gitignore` excluye la carpeta de cuerpos generada bajo `frontend/src/assets/corpus/`.

Prohibido. Corregir un cuerpo dentro de `frontend/src/assets/corpus/`, commitear esos JSON, o servir el texto desde `backend/`. Prisma no tiene modelo de documento.

## 3. Datos del lector: local primero

Canónico. Notas y temas se escriben en el dispositivo y siguen existiendo sin API.

- Notas: `AnotacionesService` (`frontend/src/app/services/anotaciones.service.ts`) y el diario `SyncJournalService` (`frontend/src/app/core/sync/sync-journal.service.ts`). Clave `dv_anotaciones_v1` (`ANOTACIONES_KEY` en `frontend/src/app/core/sync/sync-journal.logic.ts`).
- Temas: `ThemesService` (`frontend/src/app/core/account/themes.service.ts`) declara la persistencia primaria en `themes.user`. El HTTP es best-effort con sesión.
- Continuar leyendo: `dv.lastRead` (`LAST_READ_KEY`), una tarjeta de cita, no el cuerpo de la unidad.
- El merge de nube es aparte: `SyncService` (`frontend/src/app/services/sync.service.ts`) envía anotaciones y temas a `POST /api/v1/sync/merge`. No envía referencias.

Prohibido. Copiar `ReferencesService` (`frontend/src/app/core/account/references.service.ts`) para un dato que el lector anónimo debe guardar. Ese servicio solo hace `GET`/`POST`/`DELETE` de `/me/references`. No tiene clave local. Una marca nueva de lectura usa `documentId` + `unitIndex` en local, como las notas, y entra al merge cuando haya sesión.

## 4. Identidad de un tema en el merge

Canónico. `themeMergeAction` en `backend/src/routes/sync-theme.logic.ts` es la única decisión. `ThemesService.create` envía ese id en `POST /me/themes` y el alta lo guarda. El merge de `backend/src/routes/sync.ts` busca el mismo id entre los temas del dueño. Un título repetido es otro tema: se crea una fila nueva y no se pisan los pasos del anterior. `ThemesService` actualiza en local con el mismo criterio (`findIndex` por `id`).

Prohibido. Volver a emparejar por `ownerId` + `title` cuando el id local no está en la nube. Ese `findFirst` sustituía los pasos del tema viejo si ganaba el `updatedAt` local. No lo reintroduzcas en el merge, ni en estudios, ni en referencias.

## 5. `updatedAt` ausente o empatado

Canónico. Si falta la marca, reutilizar `createdAt`, como hace `ThemesService` al migrar un tema. En empate de reloj, no descartar el texto del dispositivo en silencio.

Prohibido. Dos copias que ya están en el árbol y no deben repetirse:

- `AnotacionesService` rellena un `updatedAt` ausente con `new Date()` al cargar. El merge trata esa hora como la última edición.
- `backend/src/routes/sync.ts` solo actualiza la anotación si el `updatedAt` local es estrictamente mayor. El comentario del código dice que igual o más antigua gana la nube. El bucle hace `create`/`update` de una en una.

## 6. Forma de `documentId`

Canónico. `parseDocumentId` en `frontend/src/app/core/reading/cite.ts`:

- slug de pack: `cic-es` (`/^[a-z0-9][a-z0-9-]*$/`)
- `santoral:<id>`
- `papacy:<id>`

`documentIdKey` devuelve esa misma cadena. Una cita guarda el id y el `unitIndex`, nunca el título.

`referenceDocumentId` en `backend/src/routes/references-document-id.logic.ts` es el filtro de `POST /me/references`. Acepta esas tres formas y devuelve la cadena que se guarda. Un prefijo sin id (`santoral:`, `papacy:`) no pasa. `references.ts` no elige el formato.

Prohibido. Volver a `/^[a-z0-9-]+$/i` en esa ruta. Ese filtro responde 400 `documentId invalid` para `santoral:` y `papacy:`, y deja pasar un `CIC` en mayúsculas. Un título, un `shortTitle` o un consecutivo (`LG 16`) no son `documentId`.

## 7. Hoja de estilos, barras y `DocumentMeta`

Canónico. Una hoja: `frontend/src/styles.css`. `scripts/dead-style-copies.test.js` falla si `frontend/angular.json` lista otra hoja de app, o si vuelven las copias muertas que ese test nombra (`design-product.css`, `design-reading.css`). El cromo (`wbar` / `fbar`) está contado: `scripts/agent-structure.test.js` espera 7 de esos `div`. Los campos de `DocumentMeta` son el mismo conjunto en:

- `scripts-descarga/models/corpus.model.ts`
- `frontend/src/app/core/corpus/corpus.models.ts`
- `frontend/src/app/core/corpus/corpus-load.logic.ts`

Prohibido. Pegar otra barra en una pantalla, resucitar una hoja de diseño paralela, o añadir un campo de meta en un solo de esos tres archivos.

## 8. Sesión ante un fallo de red

Canónico. `sessionEndsOnMeFailure` en `frontend/src/app/core/auth/auth-session.logic.ts` es la única decisión. `AuthService.refreshMe` llama a `logout()` solo cuando esa función lo dice: estado HTTP 401. Sin red, o con otro estado, el lector sigue y el usuario guardado permanece en `auth.accessToken`, `auth.refreshToken` y `auth.user`.

Prohibido. Cerrar sesión en el `catchError` de `GET /me` sin mirar el estado. Un fallo de red o un 500 no es un 401.

## 9. Claves que ya no existen

Canónico. Las claves vivas que un cambio de lectura o de cuenta va a encontrar:

| Clave | Dueño |
| --- | --- |
| `reader.prefs.v1` | `frontend/src/app/services/reader-prefs.logic.ts` |
| `dv.lastRead` | `frontend/src/app/core/sync/sync-journal.logic.ts` |
| `dv_anotaciones_v1` | el mismo diario y `AnotacionesService` |
| `themes.user` | `ThemesService` |
| `dv.favs` | `sync-journal.logic.ts` |
| `dv.narr.prefs.v1` | `frontend/src/app/services/narrator-prefs.logic.ts` |
| `dv.notif.prefs.v1` | `frontend/src/app/core/notifications/notification-prefs.logic.ts` |
| `dv.search.shelves.v1` | `frontend/src/app/core/search/shelf-search.logic.ts` |
| `auth.accessToken`, `auth.refreshToken`, `auth.user` | `AuthService` |

Prohibido. Reintroducir `dv.settings`, `dv.nav` o `dv.pos.*`. No hay lecturas de esas claves en `frontend/src`. El handoff viejo que las nombraba está sustituido por [design/handoff/ARQUITECTURA.md](design/handoff/ARQUITECTURA.md).

## Al tocar uno de estos

Un cambio que extienda el patrón canónico deja el hotspot como está. Un cambio que borre el patrón prohibido actualiza la fila de este archivo en el mismo PR. El mapa de cómo llegar a cada pantalla sigue en `.cursor/skills/verify-documentos-vaticanos/features/`; este archivo no lo duplica.
