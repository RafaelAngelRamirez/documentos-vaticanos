---
name: onboard-documentos-vaticanos
description: >-
  Primer paso de un agente en Documentos Vaticanos: lee el mapa de features
  y la arquitectura, y corre dv-verify Launch, Drive de lector y Cleanup.
  Úsala al entrar al repo o antes de la primera tarea. No empaqueta, no
  corta versión y no edita la skill de verificación.
---

# Onboarding de Documentos Vaticanos

Antes de la primera edición. La entrada queda hecha cuando los tres bloques de abajo están cumplidos. El typecheck no los sustituye.

## 1. Leer el mapa

Desde la raíz, en este orden:

1. `.cursor/skills/verify-documentos-vaticanos/features/README.md`
2. La ficha de la ruta de la tarea. Si todavía no hay tarea, `features/lector.md`.

Ahí está cómo se llega, cómo se conduce con `dv-verify` y qué cuenta como evidencia. `docs/features/README.md` (PR #52) declara ese directorio canónico y no copia las fichas.

## 2. Leer la arquitectura

`docs/design/handoff/ARQUITECTURA.md`, el de `master`, actualizado en el [PR #52](https://github.com/RafaelAngelRamirez/documentos-vaticanos/pull/52). Describe las capas del árbol actual.

Ese PR también trajo `docs/surfaces.md`, `docs/debt-hotspots.md`, `docs/features/README.md` y `docs/agent-readiness-plan.md`.

Después, `AGENTS.md` y `docs/agent-workflow.md`.

## 3. Correr dv-verify

Desde la raíz, en este orden. Hace falta el `dist` web que describe `.cursor/skills/verify-documentos-vaticanos/SKILL.md`. Esa skill no se edita en el onboarding. El `evidence/*.txt` lo escribe el drive; no se redacta a mano.

```bash
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs launch
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector
node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs cleanup
```

Pasa cuando:

- Launch imprime `launch ready` y `doctor ok`.
- `drive lector` sale 0 y deja `.cursor/skills/verify-documentos-vaticanos/evidence/lector.txt`.
- Cleanup termina y `evidence/` sigue en su sitio.

Si Launch no imprime `doctor ok`, el drive no se lanza. Sin subcomando, el helper imprime `usage: dv-verify.mjs launch|doctor|drive <feature>|cleanup` y sale 2. Eso comprueba el binario; no cuenta como el onboarding.

## 4. Seguir

Con el mapa, la arquitectura y los tres comandos hechos, el cambio sigue `docs/agent-workflow.md`: ficha, patrón canónico, verificación con evidencia, PR pequeño. Una ficha tocada por un refactor se actualiza en el mismo PR.
