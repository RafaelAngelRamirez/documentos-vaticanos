---
name: verify-documentos-vaticanos-api
description: "Drive the Documentos Vaticanos API with the existing smoke (yarn test:api / e2e/api-e2e.mjs). Five phases: Launch, Doctor, Drive, Evidence, Cleanup. Use when verifying auth, studies, themes, or references against /api/v1."
---

# Verify API

La superficie es la API Express (`/api/v1`). El drive es el smoke que ya existe: `e2e/api-e2e.mjs`, el mismo que `yarn test:api`. No hay cliente nuevo ni contrato OpenAPI.

Prioriza el patrón canónico documentado sobre el código existente con deuda. El patrón canónico de esta superficie es ese smoke, con `DEV_AUTH_BYPASS` en local. Si la verificación falla por deuda técnica, reporta el patrón malo y propón la corrección hacia arriba en la pirámide (arquitectura, luego análisis estático, luego instrucción).

El arranque no llama a `scripts/dev.sh`. Ese script copia `documentos/corpus` a los assets del frontend. Aquí solo suben Postgres y la API.

## Launch

Desde la raíz del repo:

```bash
node scripts/dv-verify-api.mjs launch
```

Ready cuando stdout contiene `launch ready` y `doctor ok`.

- Si `GET /api/v1/health` ya responde 200 con `ok: true` y `service: documentos-vaticanos-backend`, y el estado previo dice `owned true` para esa misma base, el launch conserva `owned`. Cleanup sigue bajando ese stack. Si no había estado propio, adopta la API (`launch adopted`, `owned false`) y cleanup no la apaga.
- Si no responde, hace `docker compose -f docker-compose.dev.yml -p documentos-vaticanos up -d postgres api` y espera el health. `owned true` si el proyecto no tenía contenedores, o si un launch anterior de esta skill ya los había creado. Si `api` o `postgres` salen durante la espera (Prisma a veces arranca antes de que Postgres acepte conexiones), el launch repite `up -d`. La espera por defecto es 180 s (`DV_VERIFY_API_WAIT_MS`).
- La URL por defecto es `http://127.0.0.1:3000`. `E2E_API_URL` o `DV_VERIFY_API_URL` la cambian.

`launch fail docker …` significa que no hay `docker compose`. No se inventa otro stack. Un launch fallido escribe `evidence/launch.txt` y sale con código distinto de cero. Un launch que llega a `launch ready` borra ese archivo si quedó de un intento anterior.

## Doctor

```bash
node scripts/dv-verify-api.mjs doctor
```

Chequeo de solo lectura, antes del drive y después de un drive fallido.

- `GET /api/v1/health` devuelve 200, `ok: true` y `service: documentos-vaticanos-backend`.
- Si el estado dice `owned true`, `docker compose ps` muestra `postgres` y `api` en marcha.

Stdout `doctor ok` es el pase. Cualquier otra cosa es fallo. El código de salida es distinto de cero.

## Drive

```bash
node scripts/dv-verify-api.mjs drive
```

Ejecuta `node e2e/api-e2e.mjs` con `E2E_API_URL` apuntando a la base del launch. El smoke hace de cliente: health, login `dev:`, `/me`, alta de profesor, referencia, tema, estudio, publicación y matrícula. Eso escribe filas en Postgres. No toca el corpus.

El pase es el código de salida 0 y la línea `=== api e2e DONE ===`. Un fallo sigue escribiendo la evidencia.

## Evidence

Cada drive escribe `.cursor/skills/verify-documentos-vaticanos-api/evidence/api-smoke.txt`.

El archivo tiene la URL, el código de salida y la salida completa del smoke (cada `OK:` es el estado resultante). Eso es la prueba. Sobrevive al cleanup.

## Cleanup

```bash
node scripts/dv-verify-api.mjs cleanup
```

Si `owned` es true, `docker compose … down` (sin `-v`: el volumen de Postgres se queda). Si ese down falla, no borra `.run/` y sale con código distinto de cero: un segundo cleanup puede tumbar el stack. Si el launch adoptó una API ajena, no apaga nada y sí borra `.run/`. No borra `evidence/`.

## Helpers

```bash
node scripts/dv-verify-api.mjs launch
node scripts/dv-verify-api.mjs doctor
node scripts/dv-verify-api.mjs drive
node scripts/dv-verify-api.mjs cleanup
```
