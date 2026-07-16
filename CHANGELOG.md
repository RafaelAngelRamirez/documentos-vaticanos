# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## Unreleased

### Fixes

* **OCR punctuation repair (padres/concilios packs, `ocr-punct-v2`):** mechanical spacing fix for OCR-derived units (`space before ,.;:`, glued clause punct, sentence boundaries, spaced ellipsis; Spanish `¿¡` spacing preserved). **Does not join** `lowercase.period.lowercase` (avoids `que.dista`→`quedista`, `es.decir`→`esdecir`, `art.cit`→`artcit`). Transform: `scripts-descarga/src/pipeline/repair_ocr_punctuation.ts`; stable `unitIndex`; dual-write corpus + assets; per-doc revisions under `documentos/corpus/revisions/ocr-punct/`. Tests: `npm run test:ocr-punct` (includes negative no-join cases).

### Features

* **Narrador · voces Grok (xAI TTS) online opcional:** proxy backend `GET /api/v1/tts/voices` + `POST /api/v1/tts/speak` con `XAI_API_KEY` (console.x.ai; **no** SuperGrok/Heavy — facturación API aparte ~$15/1M chars). El cliente lista voces Grok junto a las del sistema y reproduce audio vía proxy; sin clave/red sigue solo Web Speech / Capacitor TTS (offline-first). Preferencias **por dispositivo** en Ajustes (`dv.narr.prefs.v1`: activar Grok + voz preferida). Tests: `yarn test:tts`, `yarn test:narrator-grok`.
* **Persistencia del corpus en el navegador (web):** `CorpusService` escribe manifest + body/index en IndexedDB (`dv-corpus-v1`) al cargar; tras recarga solo re-descarga documentos nuevos o con huella cambiada (`id|bodyPath|indexPath|unitCount`). Offline sirve lo ya almacenado. Tests: `npm run test:corpus-persist`.
* **Auto-detección de actualización** en APK (Capacitor) y Electron: consultan el manifest remoto de producción (`downloadsPublicOrigin` → `/downloads/manifest.json`), comparan semver con la versión embebida y ofrecen **descarga manual** del instalador (sin instalación silenciosa). UI en Inicio y Ajustes; fallos de red no bloquean el lector offline. CORS en `/downloads/` para shells empaquetados.
* Empaquetado distribuible **web + APK + Electron** desde la misma build de producción Angular: scripts monorepo `package:web` / `package:apk` / `package:electron` / `package:all` → `dist/web`, `dist/documentos-vaticanos-debug.apk`, `dist/electron/` (AppImage + linux-unpacked); shell Electron en `frontend/electron/` con corpus offline embebido
* Design handoff **Pantallas de Diseño** (1A–6D): tokens claro/oscuro, flujo lectura 3A/3D/3E/2A/2B, producto 1B–1E, notas 3G, ajustes 3H
* Temas con cola de revisión (6A–6D): `reviewStatus`, rol `admin`, APIs `/me/themes/.../submit` y `/admin/themes`
* Padres de la Iglesia (2C/2D) en `/padres` y `/padres/:id`
* Shell web 5A–5H (`app-wbar` modes nav/auth/reader, biblioteca cardgrid + wside, detalle wcols, estudio wcols, padres grid, tema dual, notas wside) y narrador 5D (Web Speech API)
* Tema monocromo oscuro `mono` por defecto (prima sobre `paper`), selector en Ajustes con migración de preferencias legadas
* Offline-first: notas, subrayados y temas funcionan sin cuenta (`dv_anotaciones_v1`, `themes.user` en localStorage)
* Copia de seguridad local versionada: exporta/importa notas, temas y preferencias de lectura desde Ajustes
* Registro como respaldo: merge local→nube (`POST /api/sync/merge`) al iniciar sesión, sin duplicados por clave `(documentId, unitIndex)`
* UX móvil — Grupo 7 (7A–7F): back físico con `BackService` (cierra overlays antes de navegar), higiene PWA/Android (`viewport-fit=cover`, `theme-color`, sin overscroll-bounce), feedback táctil `:active` + targets ≥48px, barras auto-ocultables del lector, sheets con drag-to-dismiss y transiciones de ruta fade-through con `prefers-reduced-motion`; documentado en `AGENTS.md` §0 y `docs/design/handoff/README.md`

### [0.0.13](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.12...v0.0.13) (2023-11-05)


### Features

* Biblia funcionando ([14c20eb](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/14c20ebe81decf192b8da6a9648a2007db7e1a89))
* Descarga de biblia ([3bf253d](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/3bf253dd288051cfcdb1a29cf6ad0b4eec49da7b))
* Versiculos a puntos ([1e403a5](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/1e403a53d14f4a845bcf35e306bdce21bbe9b138))

### [0.0.12](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.11...v0.0.12) (2023-10-28)

### [0.0.10](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.9...v0.0.10) (2023-10-22)


### Features

* Versioning ([537481e](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/537481e1913d76ad9e91ee821885dac85520af99))


### Bug Fixes

* Examples not working ([23acae9](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/23acae91c7f00eadbf30b94ab9fdd5c1529115c7))
* Term expasiín fixed format ([d092d6d](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/d092d6dec5edb9bd3f9fd8ba2ff8d550aaf8bf51))
* Version position fixed ([d33f304](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/d33f304b567604571d0cf934a9126957b6cfdb80))

### [0.0.9](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.8...v0.0.9) (2023-10-22)


### Bug Fixes

* Bad speligns ([322109d](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/322109de4a411c1d09811fb479d3c75b4b09d87f))
* Redirectión prolem nginx ([2d55d54](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/2d55d542bab651d3b1563780b1b6405c165a7aa0))

### [0.0.8](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.7...v0.0.8) (2023-10-22)


### Bug Fixes

* script bad domain ([8a025a4](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/8a025a4c3567f489b34acf4590a6576499de2a88))

### [0.0.7](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.6...v0.0.7) (2023-10-22)


### Bug Fixes

* script to deploy ([e719d53](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/e719d53372c9a47d0735c6abb2303fc24e8ab05d))

### [0.0.6](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.5...v0.0.6) (2023-10-22)


### Bug Fixes

* Not ready for localize ([9794b66](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/9794b66194cfaf99074f895be16a3864c6569f2c))

### [0.0.5](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.4...v0.0.5) (2023-10-22)


### Bug Fixes

* restore production build ([300d079](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/300d079e2e36fbad0c91ebfe8a46b2fedf476a40))

### [0.0.4](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.3...v0.0.4) (2023-10-22)


### Bug Fixes

* Master branch ([c3e77e5](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/c3e77e55f91399064a105a24d5871f380a0787ea))

### [0.0.3](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.2...v0.0.3) (2023-10-22)

### [0.0.2](https://github.com/RafaelAngelRamirez/documentos-vaticanos/compare/v0.0.1...v0.0.2) (2023-10-22)


### Features

* Beetter navigation and help search improvements ([9040d05](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/9040d059a3382beb322007f30641bce4997410af))
* DevOps added ([43b398a](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/43b398af3a4278fb1d0001251e27b0eefe0fcf24))
* DevOps update app script added ([65d9198](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/65d9198fe0201fdbbf1a06b1f4789ff430619547))
* Generación de indice de texto ([7d23676](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/7d236760eba6d03f3d1d131dd356fd55f40e87f2))
* Indice funcional ([edf67b1](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/edf67b1fcd064f6d6435ce2ef16ef2e49e95e61c))
* Navigation to the search view ([f5a230d](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/f5a230db9134287f586be18a6c73a373acad115f))
* Paginator added ([09e6d43](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/09e6d431942541fc38f032bd4b68ab841ca1b1cc))
* Reader working ([3cd944b](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/3cd944b6dc0451d79e212517ba22509e589e0534))
* Readers load previews and next articles ([cb8444c](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/cb8444c8553df399990ea18b6883496c1fbf8f60))


### Bug Fixes

* Init component refactoring ([976933f](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/976933f611cb578e32827c798e3c20b8fd089eef))
* Patch match redirect not working ([3d05e2d](https://github.com/RafaelAngelRamirez/documentos-vaticanos/commit/3d05e2d5901d642d85c33d9bd4da3ebc934e4e69))
