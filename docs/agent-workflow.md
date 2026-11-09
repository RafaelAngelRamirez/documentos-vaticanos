# Flujo de un cambio

Secuencia de `AGENTS.md` con el checklist. No sustituye al mapa ni a la skill de verificación.

## Secuencia

1. Investigar. Lee `.cursor/skills/verify-documentos-vaticanos/features/README.md` y la ficha de la feature. Los límites de capa están en `docs/design/handoff/ARQUITECTURA.md`.
2. Implementar el apartado Canónico de `docs/debt-hotspots.md`. El apartado Prohibido se deja quieto.
3. Verificar y guardar la evidencia.
4. Abrir un PR pequeño contra `master`. Una tarea.

`docs/surfaces.md`, `docs/debt-hotspots.md`, `docs/features/README.md`, `docs/agent-readiness-plan.md` y `docs/design/handoff/ARQUITECTURA.md` entran con el [PR #52](https://github.com/RafaelAngelRamirez/documentos-vaticanos/pull/52) (rama `cursor/bloque-a-memoria-base-4758`). El mapa canónico ya está en `.cursor/skills/verify-documentos-vaticanos/features/`.

## Verificación

Ruta de la SPA empaquetada, desde la raíz, en este orden:

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs launch
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs doctor
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive <feature>
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs cleanup
```

`<feature>` es el id de la ficha. Launch pasa con `launch ready` y `doctor ok`. El drive escribe `.cursor/skills/verify-documentos-vaticanos/evidence/<feature>.txt`. Cleanup no borra esa carpeta.

API de cuenta, con `yarn dev` arriba:

```bash
yarn test:api
```

El cierre de la tarea lleva esa salida o el `evidence/<feature>.txt` en el PR. El typecheck no cierra el paso.

## Refactor

Si el cambio mueve una ruta, un selector o el modo de llegar a la pantalla, la ficha en `.cursor/skills/verify-documentos-vaticanos/features/` se actualiza en el mismo PR.

## Pull request

- Una tarea. Base `master`. Sin force-push. La rama se conserva.
- En la descripción: ficha tocada, comando de verificación y evidencia (ruta del txt o salida del comando).
- El onboarding de quien entra por primera vez está en `.cursor/skills/onboard-documentos-vaticanos/SKILL.md`.

## Skills que no se añaden

Build, release, n8n y verify ya cubren empaquetar, cortar versión, la cola y la prueba del lector. Investigar es leer el mapa. Planificar es este flujo y `docs/agent-readiness-plan.md`. Corregir es subir el patrón en la pirámide de `AGENTS.md`. La arquitectura es `docs/design/handoff/ARQUITECTURA.md`. Una skill nueva para cada uno de esos cuatro pasos duplicaría documentos que el #52 y el mapa ya fijan.
