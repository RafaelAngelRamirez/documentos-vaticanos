# Publicación en Play Console (Documentos Vaticanos)

## Estado 1-nov-2026 10:36 CDMX (solo documentación; sin publicar)

**El bloqueante ya no es la contraseña del keystore.** Rafa pidió buscarla y apareció. Verificado en **codice-progressio** sin imprimir valores:

| Variable / artefacto | Estado |
|----------------------|--------|
| Contenedor n8n: `DV_KEYSTORE_PASSWORD` | Presente en entorno |
| Contenedor n8n: `DV_KEY_PASSWORD` | Presente; **no se probó** el valor |
| `DV_KEY_ALIAS` | `docvat-upload` |
| `DV_KEYSTORE_PATH` (n8n) | `/secrets/docvat-upload.jks` |
| `PLAY_SERVICE_ACCOUNT_JSON` | Presente en entorno n8n |
| Host JKS | `/home/deploy/secrets/docvat/docvat-upload.jks` — `keytool -list`: entrada `docvat-upload`, `PrivateKeyEntry`, 20-jul-2026; abre con la contraseña del entorno |
| `play-service-account.json` | Misma carpeta en el host |
| `PLAYPublishV1sc` | Monta `/secrets:ro` |

Preferencia del 29-oct «no buscar secretos» **superada para este tema** (1-nov). Sigue prohibido pegar o commitear valores de secretos.

**Esta pasada no lanza el job Play ni toca n8n/servidor.**

### Tip de master

Inventario Rafa **1-nov-2026 10:36 CDMX**:

| | |
|--|--|
| SHA | ~`8e76848d` (Merge #20) |
| `package.json` | **0.0.37** |
| Tag `v0.0.38` | **Ausente** (según ese inventario) |

Rechequeo git al redactar este doc en el PR (mismo día, sin tocar n8n):

| | |
|--|--|
| `origin/master` | `486da382` `chore(release): 0.0.38` (padre `8e76848d`) |
| `package.json` en tip | **0.0.38** |
| Tag `v0.0.38` en origin | **Presente** (`5a9f3b25` → commit `486da382`) |

### Qué falta exactamente para publicar vía `PLAYPublishV1sc`

Los secretos/JKS/SA en el runner **ya están**. Falta el camino operativo (ningún agent lo dispara sin OK explícito de Rafa):

1. **Disparo del job idle** — `POST /webhook/play-publish` con `{ "app_id": "docvat" }`, o ticket `/tmp/codice-ci-pending-docvat-play.json`. El merge a `master` **no** sube AAB solo (`DV_BUILD_AAB=0`, `DV_PLAY_UPLOAD=0` en el build crítico).
2. **Cola** — `holder=play` (prioridad 30); espera detrás de Imperium / Docvat web.
3. **AAB upload-key** — ruta `/work/docvat/dist/documentos-vaticanos-release.aab`. Si falta, el job corre `bash scripts/package-aab.sh` (Cap sync + `bundleRelease` firmado con las vars de arriba). El AAB de medición cloud (~52 MB) **no** sirve.
4. **Subida** — `node scripts/play-upload-closed.js`: `edits.insert` → `bundles.upload` → `tracks.update` → `edits.commit`; track env `closed` → API **`alpha`**, status **`completed`**.
5. **Éxito** — marcador `::PLAY_PUBLISH_DONE::com.docvat` (Telegram «Play listo» no basta).
6. **Evidencia de descarga** — Console Alpha `com.docvat` release completed + opt-in `https://play.google.com/apps/testing/com.docvat` + tester de `docvat-closed-testers` instalando (no confundir con APK sideload `digital.documentosvaticanos.app`).
7. **`DV_KEY_PASSWORD` no probado** — si `package-aab` / jarsigner fallara por clave, primer sitio a revisar (sin imprimir el valor; suele caer al password del keystore).

Histórico del bloqueo por password en Dell: [`internal/aab-play-signed-blocked.md`](../internal/aab-play-signed-blocked.md).

---

## Camino: merge a `master` → Play

### 1. Disparo build web/APK

Push a `master` → flujo **Documentos Vaticanos build** (`DocumentosVaticanosBuild`). Hook `703012858`. Sidecar `DOCVATBuildV1sc` inactivo. Entrada: `.ci-build.sh`. Espera Imperium; no toma candado compartido.

### 2. Build web + APK (camino crítico)

Orden en `.ci-build.sh`: disco → release (`ci-release-guard` + `standard-version`) → deps → web → APK → collect → Docker/deploy. **AAB y Play apagados por defecto** (`DV_BUILD_AAB=0`, `DV_PLAY_UPLOAD=0`).

### 3. Job idle Play (`PLAYPublishV1sc`)

Snapshot `deploy/PLAY-publish-v1.json`:

| Campo | Valor |
|-------|--------|
| Disparo | `POST /webhook/play-publish` `{ "app_id": "docvat" }` o ticket pending |
| Package | `com.docvat` |
| Track | `closed` → API **`alpha`** |
| Status | `completed` |
| Artefacto | `/work/docvat/dist/documentos-vaticanos-release.aab` |
| Meta | `dist/aab.meta.txt` |
| Secretos Docvat | `DOCVAT_SECRETS_MOUNT` → `/home/deploy/secrets/docvat:/secrets:ro` |

### 4. Tracks y artefactos

| Qué | Dónde |
|-----|--------|
| Track operativo | Closed testing **Alpha** |
| Opt-in | `https://play.google.com/apps/testing/com.docvat` |
| Lista | `docvat-closed-testers` |
| versionCode | `0.0.x` → patch (p. ej. 0.0.37 → **37**, 0.0.38 → **38**) |

Scripts: `npm run package:aab`, `npm run play:upload-closed`. Detalle: `deploy/PLAY-CLOSED-TESTING.md`.

## Medición AAB (2026-10-29) — tamaño OK

Build cloud sobre master entonces `d65dd2d9` (0.0.37), keystore de **medición** (no upload). AAB **52 285 561** B; base bajo tope Play 500 MiB. Bloqueo de tamaño **levantado**. No sustituye el AAB firmado del runner.

## Bloqueos restantes (descarga en Play)

1. ~~Tope 500 MB base~~ — medido OK.
2. ~~Password / JKS / SA en n8n~~ — **resuelto 1-nov** (ver tabla arriba).
3. **Play no va en el merge** — hace falta disparar `PLAYPublishV1sc` (OK Rafa).
4. versionCode > 24 — tip actual **0.0.38** → 38 cumple si sube (también 0.0.37 → 37).
5. Tag huérfano `v0.0.34` — no borrar; no frena.
6. Producción — fuera de alcance; objetivo = prueba cerrada descargable.

## Checklist de evidencia de descarga

- [ ] Tag / `package.json` alineados con lo publicado.
- [ ] Play Console → `com.docvat` → Alpha: release **completed**.
- [ ] Opt-in vivo + tester instalando desde Play.
- [ ] (Opcional) `::PLAY_PUBLISH_DONE::com.docvat` en log del host.
- [ ] No confundir sideload APK con build Play.

## Notas históricas (29-oct)

Estado previo: password UNSET en shells de agent/Dell; idle esperando a Rafa («no buscar secretos»). Webhook deliveries no legibles con el token de integración (403). Alpha histórica documentada en **0.0.24** / versionCode 24 hasta que corra el job de subida.
