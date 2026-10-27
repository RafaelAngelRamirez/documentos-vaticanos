---
name: build-documentos-vaticanos
description: >-
  Empaqueta la web y el APK de Documentos Vaticanos en local y dice qué corre
  .ci-build.sh cuando el flujo n8n arranca. Úsala al pedir build, package:web,
  package:apk, package:all o el build de CI. No despliega ni toca el servidor.
---

# Build de Documentos Vaticanos

Empaqueta en la máquina local. No publiques la imagen ni recrees el contenedor.

## Local

Desde la raíz del repo:

```bash
npm run package:web
```

Salida: `frontend/dist/documentos-vaticanos` y `dist/web`. El script sincroniza el corpus si existe `documentos/corpus`.

```bash
npm run package:apk
```

Salida: `dist/documentos-vaticanos-debug.apk`. Hace falta `documentos/corpus/documents` y el SDK de Android. Sin esa carpeta el script sale con código 2.

```bash
npm run package:all
```

Web, APK, Electron y la recolección de descargas. Electron local usa `DV_ELECTRON_TARGETS` (default `linux,win`).

No ejecutes `scripts/ci-docker-push.sh` ni `scripts/ci-deploy-docvat.sh`. Publican `legna37/documentos-vaticanos:front-latest` y recrean el contenedor del sitio.

## Pruebas de antes del empaquetado

Las mismas que corre `.ci-build.sh` antes de la web:

```bash
npm run topics:validate -- --locale es
npm --prefix frontend run test:open-reading
npm --prefix frontend run test:speech-prep
npm --prefix frontend run test:speech-lang
node scripts-descarga/corpus_structure_contract.test.js
node scripts/corpus-sync-assets.test.js
```

`topics:validate` usa el ts-node de `scripts-descarga` y no lleva `--skip-fp`. Si falla por huella vieja tras un cambio de corpus, regenera con `npm run topics:build` y vuelve a validar.

## Qué corre el CI

Un push a `master` o `typescript-migration` arranca el flujo «Documentos Vaticanos build». La entrada es `.ci-build.sh`. La cola está en la skill `n8n-documentos-vaticanos`. El corte de versión está en `release-documentos-vaticanos`.

Orden, con Electron apagado (7 etapas):

1. Disco libre. Default `DV_MIN_FREE_GB=10`. `0` salta el chequeo.
2. `npx --yes standard-version@9.5.0`, salvo `DV_SKIP_RELEASE=1`.
3. Dependencias (raíz, `frontend`, `backend`, `scripts-descarga`) y las pruebas de arriba.
4. `scripts/package-web.sh` y `bash e2e/run-dist-smoke.sh`.
5. `scripts/package-apk.sh`.
6. `scripts/package-collect-downloads.sh` con `DV_REQUIRE_APK=1`.
7. `scripts/ci-docker-push.sh` y `scripts/ci-deploy-docvat.sh`.

Electron entra solo con `DV_BUILD_ELECTRON=1` (entonces son 8 etapas; el target de CI es `linux` salvo que pidas otra cosa). El AAB entra solo con `DV_BUILD_AAB=1` o `DV_PLAY_UPLOAD=1`.

Al terminar, el script imprime `::DOCVAT_BUILD_DONE::vX.Y.Z`.

Poner `DV_SKIP_RELEASE` en el runner, podar Docker del host o reimportar el flujo cambia el servidor. No lo hagas desde esta skill.
