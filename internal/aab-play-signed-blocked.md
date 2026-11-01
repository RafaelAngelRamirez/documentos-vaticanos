# AAB Play firmado — estado del bloqueo

## Histórico Dell (2026-10-29)

Host Dell. Sin emulador / adb / ng serve / wipe / puerto 5580. Sin Play upload, sin n8n, sin merge.

### Disco

- `/` disponible ≈ **13 GiB** → umbral 4 GiB **OK**; no fue el bloqueo.

### Keystore (entonces)

| Ítem | Estado 29-oct |
|------|----------------|
| `~/.config/documentos-vaticanos/docvat-upload.jks` | **Existe** (2290 B, mode 0600, mtime 2026-09-21) |
| `DV_KEYSTORE_PATH` / `DV_KEYSTORE_PASSWORD` / `DV_KEY_ALIAS` / `DV_KEY_PASSWORD` | **UNSET** en ese shell |

`scripts/package-aab.sh` salía si faltaba `DV_KEYSTORE_PASSWORD`. Parada: sin `package-aab.sh`, sin copia a `media/`. Artefactos `media/docvat-play-signed.aab*` **ausentes**.

## Actualización 1-nov-2026 10:36 CDMX (solo documentación)

Rafa pidió buscar la contraseña; apareció. Verificado en **codice-progressio** (sin imprimir valores):

| Ítem | Estado |
|------|--------|
| Contenedor n8n: `DV_KEYSTORE_PASSWORD`, `DV_KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` | **Presentes** en entorno |
| `DV_KEY_ALIAS` | `docvat-upload` |
| `DV_KEYSTORE_PATH` (en n8n) | `/secrets/docvat-upload.jks` |
| Host `.jks` | `/home/deploy/secrets/docvat/docvat-upload.jks` — `keytool -list`: una entrada `docvat-upload`, `PrivateKeyEntry`, 20-jul-2026; abre con la contraseña del entorno |
| `play-service-account.json` | Misma carpeta `/home/deploy/secrets/docvat/` |
| `PLAYPublishV1sc` | Monta `/secrets:ro` |
| `DV_KEY_PASSWORD` | Presente en entorno; **no se probó** el valor |

**El bloqueante ya no es la contraseña ni la ausencia del JKS/SA en el runner de Play.**

La preferencia del 29-oct «no buscar secretos» queda **superada para este tema**; sigue prohibido pegar o commitear valores.

## Qué falta aún (no es password)

Esta pasada **no** lanza el job ni toca n8n/servidor. Para un AAB firmado upload-key y subida vía `PLAYPublishV1sc` sigue haciendo falta (detalle en [`docs/play-publicacion.md`](../docs/play-publicacion.md)):

1. **Disparo explícito** de Play (`POST /webhook/play-publish` `{ "app_id": "docvat" }` o ticket `/tmp/codice-ci-pending-docvat-play.json`) — **OK de Rafa**; los agents no lo lanzan.
2. **Cola** libre (`holder=play` detrás de Imperium/Docvat web).
3. **AAB** en `/work/docvat/dist/documentos-vaticanos-release.aab` — el job puede generarlo con `scripts/package-aab.sh` si falta (upload key; no el AAB de medición ~52 MB).
4. **Subida completed** a Alpha `com.docvat` + marcador `::PLAY_PUBLISH_DONE::com.docvat`.
5. **Evidencia**: opt-in + tester de `docvat-closed-testers` instalando desde Play.
6. **`DV_KEY_PASSWORD` no probado** — revisar solo si falla el firmado.
