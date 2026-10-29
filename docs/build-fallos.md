# Falla del build v0.0.37

La ejecución **95530** cortó `v0.0.37`: tag anotado `e529f420` sobre `bbcfc761` (`chore(release): 0.0.37`, padre `4937c3e9`, Mr. Nochon, 2026-10-27 07:26:59 UTC). El tag está publicado en origin. En ese momento `master` era `a20021e0` y `package.json` seguía en 0.0.36. `bbcfc761` no era ancestro: 1 adelante y 9 atrás.

La ejecución **95531** (commit `6550ee05`, merge del #40, 01:39 CDMX) es la misma carrera. Ese commit sí es ancestro de master. El release no. El siguiente `standard-version` moriría con `fatal: tag 'v0.0.37' already exists`.

La ejecución **95533** (commit `a20021e0`, merge del #37, 07:43:42 UTC) es la misma carrera. No cortó versión ni APK. Al terminar, `a20021e0` seguía siendo master y `bbcfc761` seguía sin ser ancestro.

Hipótesis: 95533 clonó `a20021e0`. La app en ese SHA está en 0.0.36 y `v0.0.37` ya estaba en origin sobre `bbcfc761`, cortado por el build anterior cuando master ya había avanzado. `standard-version` propone otra vez `v0.0.37`, escribe el commit `chore(release)` y muere al etiquetar. El tag no se mueve. Este hilo no abrió n8n. El id, el commit y la hora son los que quedaron anotados con el fallo; en origin se volvió a leer el tag y los SHA.

El merge normal de `bbcfc761` es el [PR #42](https://github.com/RafaelAngelRamirez/documentos-vaticanos/pull/42), commit `8ff605b2`, 07:47:27 UTC. `bbcfc761` es ancestro. `package.json` en master queda en 0.0.37. El tag `v0.0.37` sigue en `e529f420`. No se movió ni se borró. Fuera de master queda `v0.0.34` (`0c751a8c`). No hay `v0.0.35`.

## Qué hace el script

`.ci-build.sh` llama a `scripts/ci-release-guard.sh` antes de cortar (salvo `DV_SKIP_RELEASE=1`). El guardia no hace fetch y no empuja.

1. Lee `refs/heads/master` en origin con `git ls-remote`. Si `HEAD` no es esa punta, sale **3** y no corta versión.
2. El tag siguiente sale de `standard-version --dry-run` (no escribe archivos ni tags). Si ese tag ya está en origin o en el clon, sale **2**: ni otro tag ni otro commit de release.
3. Si las dos pasan, corre `npx --yes standard-version@9.5.0`. El push del commit y del tag sigue fuera de este script.

`scripts/ci-release-guard.test.sh` lo demuestra en un remoto local de usar y tirar: tag ya presente → salida 2, el clon no gana commit ni tag; SHA que no es la punta → salida 3, no corta. Si la punta coincide y el tag no existe, el corte de prueba sí corre y no empuja.

Queda abierta la ventana en que dos builds leen la misma punta antes de que exista el tag. Cerrarla es un candado del flujo. El flujo no se tocó.
