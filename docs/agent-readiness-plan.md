# Plan: repositorio compatible con agentes

Objetivo: el camino correcto es el camino fácil. Un agente implementa, verifica el comportamiento y abre un PR pequeño. La revisión humana queda para el muestreo.

Este archivo adapta ese plan al árbol de Documentos Vaticanos. No sustituye a `AGENTS.md`. No crea reglas de lint, ni jobs de CI, ni skills nuevas.

## Principio

Cada corrección se empuja lo más arriba posible:

1. Arquitectura y código: el error deja de poder expresarse. Una implementación canónica, tipos que no admiten el estado ilegal, un límite que el otro lado no cruza.
2. Análisis estático y CI: el rechazo es mecánico y el mensaje dice qué usar.
3. Instrucciones y skills: el mínimo para encontrar el camino. Aquí viven `AGENTS.md`, este plan y la skill de verificación.
4. Revisión humana: último recurso.

## Contramedidas

- Copiar el patrón visible aunque tenga deuda. La lista está en [debt-hotspots.md](debt-hotspots.md). Se extiende la columna canónica. Si la verificación falla por ese patrón, se informa y se propone subirlo de nivel; no se clona el archivo vecino.
- Dar por terminado un cambio con el build o el typecheck. Hace falta la skill de verificación y la evidencia de la acción.
- Tratar web, Android y Electron como tres apps. Son un `dist` y dos cascarones, más la PWA. El inventario está en [surfaces.md](surfaces.md).

## Ya está en el árbol

No se vuelve a crear:

- Mapa de features versionado: `.cursor/skills/verify-documentos-vaticanos/features/` (índice `README.md`, una ficha por ruta de `frontend/src/app/pages/pages-routing.module.ts`). [features/README.md](features/README.md) lo declara canónico.
- Skill web de cinco fases: `.cursor/skills/verify-documentos-vaticanos/SKILL.md` y `.cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs` (Launch, Doctor, Drive, Evidence, Cleanup).
- Comprobaciones mecánicas de estructura: `scripts/dead-style-copies.test.js` y `scripts/agent-structure.test.js`.
- Instrucciones cortas de arranque web y API: `AGENTS.md`.
- Dirección de lectura: `frontend/src/app/core/reading/cite.ts` y `NavigationService.openReading`.

## Etapa 0 — Diagnóstico

Hecho en este nivel: superficies, hotspots y el puntero al mapa. Los comandos reales de arranque por cascarón están en [surfaces.md](surfaces.md) y en [DEV-DOCKER.md](DEV-DOCKER.md).

Pendiente de otra etapa: un corte de métricas (tareas verificadas, revisiones profundas, patrones subidos de nivel, tiempo de ciclo). No hay fichero de métricas todavía. No se inventa un número.

## Etapa 1 — Verificación

La skill web ya es el criterio de «hecho» para una ruta de la SPA empaquetada. Fases, en este orden:

1. Launch. Arranque limpio. Listo significa usable: el `dist` tiene `index.html` y `assets/corpus/manifest.json` con el documento que la ficha nombra.
2. Doctor. Chequeo de solo lectura (puerto, proceso, datos) antes de conducir.
3. Drive. La ruta se opera como un lector: URL, `data-testid`, nombre ARIA, selector de la ficha. Una ficha por vez.
4. Evidence. La acción y el estado resultante quedan en un archivo que sobrevive al cleanup.
5. Cleanup. Se detiene solo lo que la verificación arrancó.

La instrucción de la skill: no marcar terminado sin ejecutarla y sin adjuntar la evidencia. Compilar no cuenta.

Sigue fuera de este archivo: endurecer el Drive contra los patrones de [debt-hotspots.md](debt-hotspots.md), una skill o un orquestador para la API y para Android, y correr la skill en CI. El puerto de la skill web (`4219`) no es el de `yarn dev` (`4200`).

## Etapa 2 — Arquitectura

Los límites actuales están en [design/handoff/ARQUITECTURA.md](design/handoff/ARQUITECTURA.md). Los pares canónico / prohibido están en [debt-hotspots.md](debt-hotspots.md).

Reglas de un cambio de esta etapa:

- Una puerta por acción. La del lector ya es `openReading`.
- Estados ilegales fuera del tipo. `DocumentId` y `UnitIndex` salen de los parsers de `cite.ts`.
- La deuda se migra de un hotspot por PR. El PR actualiza la fila de [debt-hotspots.md](debt-hotspots.md) y, si cambió el modo de llegar, la ficha del mapa. No hay big-bang de carpetas.
- Un workaround que se repite sube a test o a lint, con un mensaje que nombra el patrón canónico y la ficha.

## Etapa 3 — Análisis estático

Hoy el typecheck de Angular es estricto (`frontend/tsconfig.json`: `strict` y plantillas estrictas). No hay ESLint ni un script único `yarn check`. Las dos pruebas de estructura de la etapa anterior ya fallan si vuelve una hoja muerta, si el cromo deja de ser 7 barras o si `DocumentMeta` diverge.

El siguiente gate, en un cambio propio, es una regla cuyo mensaje diga qué no usar, qué usar y qué ficha mirar. Hasta que exista, un agente no inventa un linter paralelo en el PR de la feature.

`yarn test:api` cubre el humo de `/api/v1`. No hay contrato OpenAPI que generar ni que verificar.

## Etapa 4 — Instrucciones y flujo

`AGENTS.md` sigue siendo el archivo corto de arranque. Ampliarlo con la pirámide, el mapa y el gate de verificación es un cambio distinto de este plan.

Flujo de un cambio de producto:

1. Leer la ficha en `.cursor/skills/verify-documentos-vaticanos/features/` y la fila de [debt-hotspots.md](debt-hotspots.md).
2. Reproducir con la skill si el comportamiento ya existe.
3. Implementar por el patrón canónico.
4. Volver a ejecutar la skill y guardar la evidencia.
5. PR pequeño. El cuerpo incluye el comando y el código de salida.

Onboarding de un agente nuevo: el primer paso es la verificación web de una ruta (Launch, Doctor, Drive de la ficha, Cleanup), no un refactor.

## Etapa 5 — Jardinería

Muestreo sobre `master`. Un patrón malo que vuelve a aparecer se sube: primero arquitectura, luego test o lint, y solo al final una frase en las instrucciones. La ficha del mapa y la skill se actualizan en el mismo PR que el cambio de comportamiento.

El documento de jardinería y el de métricas son de esta etapa y de la siguiente. No forman parte de la memoria base.

## Hecho

Un agente completa una tarea media de una ruta ya mapeada, adjunta la evidencia de la skill y abre el PR sin que nadie le dicte el camino, y el fallo que se corrige no reaparece porque copió el archivo de al lado.
