---
name: verify-documentos-vaticanos-theme-merge
description: >-
  Verifica en exhaustivo acotado la identidad de un tema en POST /sync/merge
  (planThemeMerges / themeMergeAction): solo el id, reenganche de una alta a
  la única fila propia sin nombrar, sin robar tema ajeno. Úsala al tocar
  sync-theme.logic.ts, sync.ts (bloque de temas), themes.ts (POST),
  ThemesService.create, o docs/debt-hotspots.md §4. No sustituye yarn test:api
  ni el test unitario sync-theme.logic.test.js.
---

# Verificar identidad de temas en el merge

## Promesa y daño

**Promesa.** En `POST /api/v1/sync/merge`, la identidad de un tema es solo el `id`. Una sola alta (id nuevo o id que no se puede guardar) con una sola fila propia que el envío no nombra actualiza esa fila y no inserta otra. Un id de otro dueño no se escribe como create.

**Daño si se rompe.** El dispositivo duplica temas o pisa el tema (y los pasos) de otro dueño / de la fila que debía reengancharse. El patrón prohibido de emparejar por `title` está documentado en `docs/debt-hotspots.md` §4.

## ¿Toca código verificado?

Corre esta skill si el cambio entra en cualquiera de:

| Archivo | Funciones / zona |
| --- | --- |
| `backend/src/routes/sync-theme.logic.ts` | `themeMergeAction`, `planThemeMerges`, `signedCreateThenMerge`, `themeDeviceId` |
| `backend/src/routes/sync.ts` | bloque que llama `planThemeMerges` y aplica create/update/mint de temas |
| `backend/src/routes/themes.ts` | `POST /api/v1/me/themes` (alta firmada con `themeMergeAction` / `themeDeviceId`) |
| `frontend/src/app/core/account/themes.service.ts` | `create` (envía `id`, `adoptServerThemeId`) |
| `docs/debt-hotspots.md` | §4 Identidad de un tema en el merge |

Si solo cambian títulos de UI o rutas ajenas al merge de temas, no hace falta.

## Herramienta y por qué

No hay verificador formal que corra sobre este TypeScript en el repo. La pregunta es «¿la función se comporta para toda entrada alcanzable hasta un bound?», no un orden de eventos de protocolo aparte. El chequeo importa el `.ts` real con `scripts/node-strip-types.sh` y enumera el producto del bound. No uses un modelo TLA+ a mano de esta función: divergería del código.

## Cómo correrlo

Desde la raíz del repo (un comando, ~1 s):

```bash
yarn test:theme-merge-identity
```

Equivale a:

```bash
bash scripts/node-strip-types.sh \
  .cursor/skills/verify-documentos-vaticanos-theme-merge/scripts/verify-theme-merge-identity.js
```

Pasa con salida 0 e imprime JSON `{"ok":true,...}`. Falla con salida 1 y el contraejemplo en términos de `incomingIds`, `ownedIds`, `occupants` y `actions`.

El test unitario puntual sigue siendo:

```bash
bash scripts/node-strip-types.sh backend/src/routes/sync-theme.logic.test.js
```

Ese test no sustituye al exhaustivo: solo fija casos elegidos a mano.

## Propiedades (en el bound)

El script nombra:

| Id | En una frase |
| --- | --- |
| P1-no-steal | Todo `update` apunta a un id en `ownedIds`. |
| P2-reattach-single | Una alta + una fila propia sin nombrar → `update` de esa fila. |
| P3-create-keeps-incoming-id | Un `create` usa el id entrante de ese índice. |
| P4-owner-occupant-updates | Ocupante = este dueño → `update` de ese id. |
| P5-foreign-mints-without-reattach | Id ajeno sin reenganche → `mint`, nunca `create` de ese id. |
| signedCreateThenMerge-roundtrip | Alta firmada + merge siguiente → `update` del id del dispositivo. |

## Bounds y supuestos

- Alfabeto de ids: `d1`, `d2`, `s1`.
- Hasta 2 temas entrantes y hasta 2 filas propias en la nube.
- Dueño fijo `user-1`, ajeno `user-2`.
- Solo entradas **alcanzables** desde cómo `sync.ts` arma `ownedIds` y `occupants` (ocupante propio ⇒ id en `ownedIds`; ocupante ajeno o ausente ⇒ id no está en `ownedIds`).
- No modela Prisma, HTTP, títulos, pasos del tema, ni el merge de anotaciones.
- Un pase cubre el bound y las entradas alcanzables, no todo el sistema ni ids de longitud arbitraria.

## Hallazgo vs error de modelo

- Contraejemplo con `incomingIds` / `ownedIds` / `occupants` que `sync.ts` puede construir → **bug** (o rotura intencional). Repórtalo; no debilites la propiedad ni edites producto salvo que Rafa lo pida.
- Caso que viola el filtro `reachable` del script (p. ej. ocupante propio con id fuera de `ownedIds`) → no es un hallazgo de producto; es entrada inalcanzable. No la uses para «arreglar» el checker debilitando P1.
- Si el código cambió la promesa a propósito (comentario, test, hotspot §4), actualiza propiedades y este archivo; cita la evidencia. Si no hay evidencia, trata el fallo como bug.

## Cobertura y sync

| Check | Cubre |
| --- | --- |
| `scripts/verify-theme-merge-identity.js` | `themeMergeAction`, `planThemeMerges`, `signedCreateThenMerge`, `themeDeviceId` en `backend/src/routes/sync-theme.logic.ts`, bajo el supuesto de entradas que arma `sync.ts` |

**Sync commit:** `cc4602df53dbc55a45f402d6001005fdc6427153` (master `0.0.74` al confirmar que esta verificación describe ese código).

Mueve el sync commit adelante solo después de confirmar que la verificación sigue describiendo el código en el commit nuevo. Si el código cubierto cambió y no re-corriste esto, usa `/maintain-formal-verification-skill`.

## Tras un cambio intencional

1. Ajusta el script o las propiedades para que cada paso siga apuntando al código.
2. Corre el comando de arriba; debe pasar (o fallar solo en hallazgos que vas a reportar).
3. Rompe en scratch la promesa (p. ej. borra el bloque de reenganche en `planThemeMerges`) y confirma que el script sale 1.
4. Descarta el scratch; deja el árbol limpio.
5. Actualiza la tabla de cobertura y el sync commit en este archivo.

## Qué no cubre

- `anotacionMergePlan` / relojes de anotaciones (`sync-anotacion.logic.ts`).
- Diario local `sync-journal.logic.ts` (HLC, lápidas, proyección).
- Sesión ante fallo de red (`sessionEndsOnMeFailure`).
- Forma de `documentId` / citas.
- Integración real con Postgres (`yarn test:api`).
