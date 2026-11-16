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

`.ci-build.sh` las corre en la etapa 3, después de instalar dependencias y antes de `scripts/package-web.sh`:

```bash
npm run topics:validate -- --locale es
bash scripts/ci-cheap.sh
```

`topics:validate` usa el ts-node de `scripts-descarga` y no lleva `--skip-fp`. Si falla por huella vieja tras un cambio de corpus, regenera con `npm run topics:build` y vuelve a validar.

`scripts/ci-cheap.sh` es la lista canónica (también la usa el workflow de pull request). Con `DV_CI=1` corre, en este orden: `bash scripts/ci-agent-gate.sh map`; en `frontend`, `test:open-reading`, `test:reader-prefs`, `test:unit-bookmark`, `test:review`, `test:reader-bars`, `test:mobile-flows`, `test:speech-prep`, `test:speech-lang`, `test:read-aloud`, `test:ui-i18n`, `test:clases`, `test:sync-journal`, `test:unpack-ship-index`, `test:shelf-search`; `node scripts-descarga/corpus_structure_contract.test.js`; `node scripts/corpus-sync-assets.test.js`; `node scripts/patristic-pack.test.js` y `node scripts/patristic-pack.js proof --canonical documentos/corpus --check`; `frontend/src/app/core/corpus/patristic-pack.logic.test.js` vía `scripts/node-strip-types.sh`; `node scripts/on-demand-sources.test.js`; `bash scripts/on-demand-ship.test.sh`; `node scripts/dead-style-copies.test.js`; `node scripts-descarga/write_corpus_copy.test.js`; `backend/src/routes/references-document-id.logic.test.js` vía `scripts/node-strip-types.sh`; `node scripts/agent-structure.test.js`; `bash scripts/ci-release-guard.test.sh`; `node scripts/ci-evidence-policy.test.mjs`; en `backend`, `test:sync-theme` y `test:sync-anotacion`; en `frontend`, `test:anotaciones`.

El gate completo del agente (`bash scripts/ci-agent-gate.sh`) queda fuera de esa lista. `.ci-build.sh` solo lo corre con `DV_AGENT_GATE=1`, después del smoke de `dist`. `check-map` ya entra en `ci-cheap.sh` por `ci-agent-gate.sh map`.

## Qué corre el CI

Un push a `master` o `typescript-migration` arranca el flujo «Documentos Vaticanos build». La entrada es `.ci-build.sh`. La cola está en la skill `n8n-documentos-vaticanos`. El corte de versión está en `release-documentos-vaticanos`.

Orden, con Electron apagado (7 etapas). El APK también va apagado: cada merge a `master` publica solo la web.

1. Disco libre. Default `DV_MIN_FREE_GB=10`. `0` salta el chequeo.
2. `scripts/ci-release-guard.sh`, salvo `DV_SKIP_RELEASE=1`. Si el SHA del evento o `HEAD` no es la punta de `origin/master`, si la punta ya es `chore(release):`, o si el tag que saldría ya está en origin, el script sale y no crea commit ni tag. Si pasa, corre `npx --yes standard-version@9.5.0`.
3. Dependencias (raíz, `frontend`, `backend`, `scripts-descarga`) y las pruebas de arriba.
4. `scripts/package-web.sh` y `bash e2e/run-dist-smoke.sh`.
5. `scripts/package-apk.sh` solo con `DV_BUILD_APK=1`. El default es `0`: el paso se salta y el deploy sigue.
6. `scripts/package-collect-downloads.sh`. `DV_REQUIRE_APK` sigue a `DV_BUILD_APK` (default `0`). Sin APK el script escribe `manifest.json` con `version: null`, `available.apk: false` y `downloads.apk: null`, y no sale con error (`DV_ALLOW_EMPTY_DOWNLOADS=1`). Así el aviso de actualización no anuncia un APK que este build no generó.
7. `scripts/ci-docker-push.sh` y `scripts/ci-deploy-docvat.sh`. Publican la web. El APK en `frontend/dist/documentos-vaticanos/downloads/` solo se exige si `DV_REQUIRE_APK=1`.

Para volver a construir y publicar el APK en el runner, exporta `DV_BUILD_APK=1` antes de `.ci-build.sh`. No hace falta tocar el flujo n8n: el default vive en el script. El AAB y Play siguen apagados.

Electron entra solo con `DV_BUILD_ELECTRON=1` (entonces son 8 etapas; el target de CI es `linux` salvo que pidas otra cosa). El AAB entra solo con `DV_BUILD_AAB=1` o `DV_PLAY_UPLOAD=1`.

Al terminar, el script imprime `::DOCVAT_BUILD_DONE::vX.Y.Z`.

Poner `DV_SKIP_RELEASE` en el runner, podar Docker del host o reimportar el flujo cambia el servidor. No lo hagas desde esta skill.
