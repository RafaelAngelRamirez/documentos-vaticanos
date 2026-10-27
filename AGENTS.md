# AGENTS.md — Documentos Vaticanos

Lector católico offline. El corpus va empaquetado: se lee, se busca y se anota sin cuenta y sin red. El foco es la app móvil Android (Capacitor, `frontend/android`, id `digital.documentosvaticanos.app`). La misma base web también se empaqueta como PWA y como Electron.

## Desarrollo local

Un comando, desde la raíz:

```bash
yarn dev
```

En `package.json` es `bash scripts/dev.sh`. Levanta Postgres, la API y Angular con Docker Compose.

- Web: http://localhost:4200
- API: http://localhost:3000/api/v1/health

`yarn dev:down` baja el stack.

## Pruebas

Con la API de ese stack en marcha:

```bash
yarn test:api
```

Es `node e2e/api-e2e.mjs`. Habla con `http://127.0.0.1:3000` y usa el `DEV_AUTH_BYPASS` que deja `yarn dev`.

## Dónde vive cada cosa

| Ruta | Qué es |
|------|--------|
| `frontend/` | App Angular y proyecto Android (Capacitor) |
| `backend/` | API Express + Prisma (`/api/v1`) |
| `scripts-descarga/` | Scrapers de vatican.va y herramientas del corpus |
| `.cursor/skills/verify-documentos-vaticanos/` | Skill que abre el lector web empaquetado y comprueba una ruta |

## Ramas

`master` es la rama principal. Una tarea por pull request. Sin force-push. No borrar ramas.

## Build

El build de n8n de Documentos Vaticanos espera a Imperium y no se modifica desde este repo.
