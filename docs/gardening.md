# Jardinería

Muestreo sobre `master`. La muestra es el diff de un merge y un archivo vecino que ya usa el mismo patrón. El árbol entero queda fuera de la pasada.

Un patrón que vuelve a verse se sube por la pirámide de `docs/agent-readiness-plan.md`: arquitectura, después test o lint, y al final una frase en las instrucciones. El refactor de un hotspot es otro bloque. Este archivo no lo abre.

## Cadencia

Cada merge a `master` que toque `frontend/src` o `backend/src`.

Un merge de docs, de corpus o de empaquetado no abre muestra. Sin un merge de ese tipo, no hay muestra.

La subida espera a la segunda vez. La primera vez el patrón queda nombrado en `docs/debt-hotspots.md` o en la ficha del mapa. La muestra siguiente, si lo vuelve a ver, lo sube.

## Owner

La cuenta que mantiene `master`: `RafaelAngelRamirez`. No hay `CODEOWNERS`.

El muestreo va en el PR que sube el patrón, no dentro del PR de la feature.

## Cómo sube un patrón recurrente

Recurrente: la muestra lo ve otra vez después de estar nombrado.

1. Arquitectura, cuando el error puede dejar de escribirse: un tipo, una sola puerta, o borrar la copia. El mismo PR actualiza la fila de `docs/debt-hotspots.md`. Si cambió el modo de llegar a la pantalla, actualiza la ficha en `.cursor/skills/verify-documentos-vaticanos/features/`.
2. Lint o test, cuando el patrón todavía se puede escribir. El fallo dice qué no usar, qué usar y qué ficha mirar. El comando que ya corre el lint es `yarn run check`. Destinos que ya están:
   - `docvat/no-margin-left-auto` en `frontend/eslint-rules/no-margin-left-auto.mjs`. Cubre el empuje flex `margin-left: auto`. El canónico es `margin-inline-start: auto`. Esa regla no se duplica.
   - `scripts/dead-style-copies.test.js`. Cubre `design-product.css` y `design-reading.css`.
   - `scripts/agent-structure.test.js`. Espera `chrome-divs=7` (`div` con clase `wbar` o `fbar`) y el mismo `DocumentMeta` en los tres archivos del test.
   - El drive web, en `dv-verify.mjs`, con `DEBT FAIL` para `legacy-reading-keys`, `dead-style-copies` y `ensure-all-loaded`. `margin-left: auto` no es un fallo de ese drive. La ficha `buscar.md` lo deja como deuda presente.
3. Una frase en `AGENTS.md` o en la skill, cuando la arquitectura y el análisis estático no pueden cargar el patrón.

El checklist de evidencia del PR está en el [PR #57](https://github.com/RafaelAngelRamirez/documentos-vaticanos/pull/57), abierto y sin merge. La secuencia corta del cambio está en `docs/agent-workflow.md`.

El escalado queda fuera de esta rutina. `docs/agent-metrics.md` lo deja diferido.
