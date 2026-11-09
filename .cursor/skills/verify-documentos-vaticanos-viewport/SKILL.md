---
name: verify-documentos-vaticanos-viewport
description: "Drive the Documentos Vaticanos web reader at a 390x844 phone viewport. Reuses verify-documentos-vaticanos for Launch, Doctor, and Cleanup. Use when an Android emulator is not available and the proof is the mobile web layout."
---

# Verify viewport 390×844

La superficie móvil de este repo, cuando no hay emulador, es el mismo lector web con viewport 390×844. No es un AVD, no es WebView de Android y no publica en Play.

Launch, doctor y cleanup delegan en `.cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs`. El mapa de rutas sigue siendo el de esa skill. No se copia. El drive no delega: ese helper fija el viewport en 1280×800, y esta skill no edita esos archivos.

Prioriza el patrón canónico documentado sobre el código existente con deuda. El patrón canónico es el verify web (un servidor estático, un drive por contexto, prueba `lector` en `/leyendo/cic-es/punto/2`). Si la verificación falla por deuda técnica, reporta el patrón malo y propón la corrección hacia arriba en la pirámide (arquitectura, luego análisis estático, luego instrucción).

## Choque con Android

El diagnóstico de brecha nombra una skill Android o este viewport. Aquí no se crea un AVD, no se instala una imagen de emulador, no se tocan keystores y no se publica en Play. La prueba es Chromium con el viewport de layout 390×844.

## Launch

Desde la raíz del repo:

```bash
node scripts/dv-verify-viewport.mjs launch
```

Hace el launch del verify web. Ready cuando stdout contiene `launch ready` y `doctor ok`. El pid queda en `.cursor/skills/verify-documentos-vaticanos/.run/state.json`. Misma URL por defecto: `http://127.0.0.1:4219`. Valen `DV_VERIFY_PORT`, `DV_VERIFY_DIST`, `DV_VERIFY_BASE_URL` y `DV_VERIFY_FORCE_SERVE`.

Hace falta el SPA empaquetado (`frontend/dist/documentos-vaticanos/index.html` o `dist/web`). Esta skill no empaqueta y no sincroniza el corpus.

## Doctor

```bash
node scripts/dv-verify-viewport.mjs doctor
```

Es el doctor del verify web, de solo lectura: `GET /` con `<app-root`, manifiesto con al menos dos documentos e `cic-es`, y el pid propio vivo. Stdout `doctor ok` es el pase.

## Drive

```bash
node scripts/dv-verify-viewport.mjs drive lector
```

Abre Playwright desde `e2e/node_modules/playwright`. El viewport de la página es 390×844. El contexto es anónimo y, antes de arrancar la app, escribe `reader.prefs.v1` con `uiLocale` y `contentLocale` en `es`, igual que el verify web.

El binario es `DV_VERIFY_CHROMIUM`, o `/usr/bin/chromium` si existe, el mismo que usa el verify web. Si no hay ninguno de los dos, usa el Chromium del paquete `playwright` de `e2e/` (hace falta `npx --prefix e2e playwright install chromium`). No apunta a `/usr/bin/google-chrome`.

`drive lector` abre la misma puerta que el verify web y comprueba el lector a este ancho. La dirección canónica la arma `readingCommands` en `frontend/src/app/core/reading/cite.ts`: `/leyendo/:id/u/:unit`. `/punto/` sigue enrutando al lector y la app la sustituye (`replaceWith`).

- Acción. `GET /leyendo/cic-es/punto/2`.
- Resultado. La URL contiene `/leyendo/cic-es/u/2`. `app-lector` está en el DOM. `app-punto` es visible. `.bnav` cuenta 0 (el lector no lleva barra inferior a ningún ancho). `viewport_actual` es `390x844`. `inner` width es menor que 1024.

`drive biblioteca` es la prueba del cromo móvil. A menos de 1024 px la biblioteca muestra `.only-mobile` y `app-bnav`, y oculta `.only-desktop`. El enlace `Biblioteca` de la barra de escritorio (`app-wbar`) no cuenta: a 390 px no es el cromo visible.

- Acción. `GET /biblioteca`.
- Resultado. El texto `Biblioteca` es visible dentro de `.only-mobile`. `app-bnav` tiene `display: block`. La barra `.bnav` (posición fija; el host queda a altura 0) tiene altura mayor que 0. `.only-mobile` no está en `none`. `.only-desktop` está en `none`.

Ids desconocidos salen con código distinto de cero. No se reenvían al drive de 1280×800.

## Evidence

Cada drive escribe `.cursor/skills/verify-documentos-vaticanos-viewport/evidence/<feature>.txt`.

El archivo tiene el viewport pedido, el viewport real, la URL de la acción, la URL resultante, los selectores y un extracto. Eso es la prueba. No escribe en `evidence/` del verify web. Sobrevive al cleanup.

## Cleanup

```bash
node scripts/dv-verify-viewport.mjs cleanup
```

Es el cleanup del verify web: `SIGTERM` solo al pid propio, borra su `.run/`, no borra evidencias. La evidencia de este viewport está en otro directorio y tampoco se borra.

## Helpers

```bash
node scripts/dv-verify-viewport.mjs launch
node scripts/dv-verify-viewport.mjs doctor
node scripts/dv-verify-viewport.mjs drive lector
node scripts/dv-verify-viewport.mjs drive biblioteca
node scripts/dv-verify-viewport.mjs cleanup
```
