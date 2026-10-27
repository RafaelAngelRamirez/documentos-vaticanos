---
name: release-documentos-vaticanos
description: >-
  Corta la versión de Documentos Vaticanos con standard-version y .versionrc.
  Úsala al pedir release, tag, chore(release) o standard-version. No hace
  force-push, no borra tags y no cambia el servidor.
---

# Release de Documentos Vaticanos

La versión de producto es la de `package.json` en la raíz. El tag es `v` más ese número.

## Quién la corta

En el build de CI, `.ci-build.sh` corre esto con el árbol limpio, antes de instalar dependencias:

```bash
npx --yes standard-version@9.5.0
```

El commit y el tag quedan en el clon. El flujo n8n los empuja al remoto con el artefacto. El script imprime `::DOCVAT_VERSION::vX.Y.Z`.

`npm run release` es `standard-version && git push --follow-tags origin HEAD`. No lo corras en `master` ni en `typescript-migration`. Ese push arranca otra vez «Documentos Vaticanos build», y el build vuelve a ejecutar standard-version.

Para ver el siguiente número sin escribir archivos ni tags:

```bash
npx --yes standard-version@9.5.0 --dry-run
```

## Qué archivos sube

Los de `.versionrc`, con `standard-version-updater.js` donde no basta el tipo `json`:

- `package.json`
- `frontend/package.json`
- `scripts-descarga/package.json`
- `README.md`
- `frontend/src/environments/environment.ts`
- `frontend/src/environments/environment.prod.ts`
- `frontend/src/assets/downloads/manifest.json`

El updater lee la última cadena semver del archivo. En `README.md`, si no hay ninguna, `readVersion` falla y ese archivo no sube. No inventes una versión en el README para forzarlo.

El bump es el de standard-version 9.5.0 con conventionalcommits. Con `package.json` en `0.0.x` el preset lleva `preMajor` (`semver.lt(versión, '1.0.0')`). Eso baja un nivel: `feat` sube patch y un breaking sube minor. `whatBump` arranca en patch y siempre propone bump, así que `fix`, `docs` o `test` también suben patch. Fusionar solo documentación corta la siguiente versión. Hoy esa siguiente es `v0.0.34`, y ese tag ya existe fuera de `master`. Si no es ancestro de `HEAD`, el CI falla al recrear el tag. No lo recrees.

## Parar

No hagas force-push de la rama ni del tag. No borres tags.

Antes de cortar, compara el tag que saldría con lo que ya existe:

```bash
git describe --tags --abbrev=0 HEAD
git rev-parse --verify "vX.Y.Z^{commit}"
```

Si ese tag ya existe y no es ancestro de `HEAD`, para. No lo recrees. `package.json` puede seguir en un número menor: es el caso en que el commit `chore(release)` quedó solo en el tag y no en la rama.

`DV_SKIP_RELEASE=1` en `.ci-build.sh` salta el bump. Ponerlo en el runner cambia el servidor. No lo hagas desde esta skill.
