# Métricas

Corte leído en `master` `e6e702d7` (2026-11-09). No hay serie anterior. Donde el árbol no guarda la medida, el corte queda sin cifra.

Las cuatro medidas son las del plan (`docs/agent-readiness-plan.md`, etapas 0 y 6): tareas verificadas de forma empírica, revisiones humanas profundas, patrones de deuda pasados a restricción, y tiempo de ciclo.

## Tareas verificadas de forma empírica

El corte es el inventario de evidencia commiteada en ese `master`. Un porcentaje pediría un registro de tareas, y ese registro no está en el árbol.

| Superficie | Archivo | Qué guarda el txt |
| --- | --- | --- |
| Web | `.cursor/skills/verify-documentos-vaticanos/evidence/lector.txt` | `result_url` del lector y un extracto. Sin `exit_code`. |
| Web | `.cursor/skills/verify-documentos-vaticanos/evidence/biblioteca.txt` | `result_url` y un extracto. Sin `exit_code`. |
| Web | `.cursor/skills/verify-documentos-vaticanos/evidence/buscar.txt` | `result_url` y un extracto. Sin `exit_code`. |
| Viewport 390×844 | `.cursor/skills/verify-documentos-vaticanos-viewport/evidence/lector.txt` | `viewport 390x844` y `result_url`. Sin `exit_code`. |
| Viewport 390×844 | `.cursor/skills/verify-documentos-vaticanos-viewport/evidence/biblioteca.txt` | `viewport 390x844` y `result_url`. Sin `exit_code`. |
| API | `.cursor/skills/verify-documentos-vaticanos-api/evidence/api-smoke.txt` | `exit_code 0` y `result api e2e DONE`. |

El mapa tiene 20 fichas (los `.md` de `features/` distintos de `README.md`). Con evidencia web commiteada están lector, biblioteca y buscar. Con evidencia de viewport 390×844 están lector y biblioteca. Buscar no tiene txt de viewport.

Esos archivos no son una tasa de tareas.

## Revisiones humanas profundas

El corte queda sin cifra. El repo no tiene etiqueta, campo ni lista de revisión profunda.

## Patrones de deuda pasados a restricción

El corte es la lista de restricciones que ya rechazan un patrón. `docs/debt-hotspots.md` tiene los apartados 1 a 9: es el catálogo. Un apartado del catálogo entra aquí solo si hay un rechazo mecánico.

| Patrón | Dónde se rechaza | Qué sigue en el árbol |
| --- | --- | --- |
| Hojas `design-product.css` y `design-reading.css` | `scripts/dead-style-copies.test.js` y el drive `dead-style-copies` | La hoja viva es `frontend/src/styles.css`. |
| `DocumentMeta` distinto, o un `div` de cromo de más o de menos | `scripts/agent-structure.test.js` (`meta-fields=ok`, `chrome-divs=7`) | Los tres archivos de meta que el test nombra. |
| Empuje flex con `margin-left: auto` | `docvat/no-margin-left-auto` (`frontend/eslint-rules/no-margin-left-auto.mjs`) | El canónico es `margin-inline-start: auto`. El drive no falla por este margen. |
| Claves `document_id`, `article_selected`, `actual_index`, `dv.settings`, `dv.pos.*` | Drive `legacy-reading-keys` | Siguen nombradas en `cite.ts` y se borran al arrancar. |
| Cuatro o más `content.json` en un drive | Drive `ensure-all-loaded` | `ensureAllLoaded` sigue en `CorpusService`, marcado deprecated. |

`dead-style-copies` es un patrón con dos puertas (el test y el drive). Cuenta una vez.

## Tiempo de ciclo

El corte queda sin cifra. No hay marca de inicio ni de fin de una tarea. `git log` no es esa medida.

## Mantenimiento del mapa

El comando del mapa es:

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/check-map.mjs
```

La salida de esta rama está en el cuerpo del PR. El job de CI que lo exige está en el [PR #57](https://github.com/RafaelAngelRamirez/documentos-vaticanos/pull/57), sin merge. Este archivo no añade un workflow.

## Escalado

El escalado queda diferido hasta que el verify web sea fiable en CI.

En este árbol el launch web pide `frontend/dist/documentos-vaticanos/index.html`, y ese archivo no está versionado. El cuerpo del PR #57 registra el drive de lector con salida 1 por esa falta, y registra que ese drive no tumba el job. Hasta que ese verify falle el CI cuando el lector no abre, no hay paralelismo de agentes que documentar aquí.
