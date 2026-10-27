# Falla del build v0.0.37

La ejecución **95530** cortó `v0.0.37`: tag anotado `e529f420` sobre `bbcfc761` (`chore(release): 0.0.37`, padre `4937c3e9`, Mr. Nochon, 2026-10-27 07:26:59 UTC). El tag está publicado en origin. `master` (`a20021e0`) sigue con `package.json` en 0.0.36. `bbcfc761` no es ancestro: 1 adelante y 9 atrás.

La ejecución **95531** (commit `6550ee05`, merge del #40, 01:39 CDMX) es la misma carrera. Ese commit sí es ancestro de master. El release no. El siguiente `standard-version` moriría con `fatal: tag 'v0.0.37' already exists`.

La ejecución **95533** (commit `a20021e0`, merge del #37, 07:43:42 UTC) es la misma carrera. No cortó versión ni APK. `a20021e0` sigue siendo master. `bbcfc761` sigue sin ser ancestro.

Arreglo: merge normal de `bbcfc761` a master. El tag no se mueve, no se borra y no se recrea.

Tags de release en origin que no son ancestros de `master`: `v0.0.34` (`0c751a8c`) y `v0.0.37` (`bbcfc761`). `v0.0.36` ya es ancestro (`0bb28064`). No hay `v0.0.35`. No hay otro tag huérfano.
