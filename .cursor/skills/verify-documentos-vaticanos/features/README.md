# Documentos Vaticanos verification map

This directory is the maintained source for verifying the user-facing web app. Read this index, then drive one feature file. The helper is `dv-verify` (`scripts/dv-verify.mjs`).

## Baseline preconditions

- Launch with `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs launch` so the base URL is `http://127.0.0.1:4219` unless `DV_VERIFY_BASE_URL` is set.
- Run `doctor` and require `doctor ok` before a drive.
- The packaged tree must contain `index.html` and `assets/corpus/manifest.json` with `cic-es`.
- Drives are anonymous. Do not reuse a browser profile.
- One server per port. Do not start a second `spa-static` on that port.
- Cleanup removes `.run/` and the owned pid. It does not remove `evidence/`.

## Driving conventions

- Start from a healthy doctor. Each drive uses a new browser context.
- Prefer the URL, `data-testid`, ARIA name, and component selector named in the feature file.
- Run every command from the repo root, exactly as written.
- The helper pins `reader.prefs.v1` to `uiLocale: es` and `contentLocale: es` before paint. Assert the Spanish catalog. A bare browser with an English `navigator.language` would show `en.json` instead.

## Proof and skip reporting

- The evidence file records the action URL and the result URL plus a text excerpt.
- A feature that needs an admin session is not verified by the anonymous redirect. Report the attempted path and the missing session.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file has an H1, one paragraph, then these H2 sections in order.

1. `Sub-features`
2. `How to get to it (user POV)`
3. `Driving it with dv-verify`
4. `Gotchas`

## Route index

Every `path:` in `frontend/src/app/pages/pages-routing.module.ts` is named in one feature file.

| Source path | Feature file |
|---|---|
| `ROUTE.inicio` (`inicio`) | [inicio.md](./inicio.md) |
| `**` redirect to `/inicio` | [inicio.md](./inicio.md) |
| `ROUTE.about` (`about`) | [about.md](./about.md) |
| `ROUTE.list_documents` (`documentos/listar`) | [biblioteca.md](./biblioteca.md) |
| `biblioteca` | [biblioteca.md](./biblioteca.md) |
| `buscar` | [buscar.md](./buscar.md) |
| `cuenta` | [cuenta.md](./cuenta.md) |
| `cuenta/referencias` | [referencias.md](./referencias.md) |
| `cuenta/temas` | [temas.md](./temas.md) |
| `cuenta/temas/:id` | [temas.md](./temas.md) |
| `notas` | [notas.md](./notas.md) |
| `estudio` | [estudios.md](./estudios.md) |
| `estudios` | [estudios.md](./estudios.md) |
| `estudios/:id` | [estudios.md](./estudios.md) |
| `estudios/:id/editar` | [estudios.md](./estudios.md) |
| `aprendizaje` | [aprendizaje.md](./aprendizaje.md) |
| `explorar` | [explorar.md](./explorar.md) |
| `explorar/relaciones` | [explorar.md](./explorar.md) |
| `explorar/topicos/:slug` | [explorar.md](./explorar.md) |
| `ajustes` | [ajustes.md](./ajustes.md) |
| `documento/:id` | [documento.md](./documento.md) |
| `admin/revision` | [admin-revision.md](./admin-revision.md) |
| `admin/revision/:id` | [admin-revision.md](./admin-revision.md) |
| `padres` | [padres.md](./padres.md) |
| `padres/:id` | [padres.md](./padres.md) |
| `doctores` | [doctores.md](./doctores.md) |
| `doctores/:id` | [doctores.md](./doctores.md) |
| `santoral` | [santoral.md](./santoral.md) |
| `santoral/:id` | [santoral.md](./santoral.md) |
| `papas` | [papas.md](./papas.md) |
| `papas/:id` | [papas.md](./papas.md) |
| `lectio` | [lectio.md](./lectio.md) |
| `` `${ROUTE.leyendo}/:documento` `` (`leyendo/:documento`) | [lector.md](./lector.md) |
| `` `${ROUTE.leyendo}/:id/${ROUTE.punto}/:user` `` (`leyendo/:id/punto/:user`) | [lector.md](./lector.md) |

## Features

- [Inicio](./inicio.md) covers `inicio`, the welcome actions, and the `**` redirect.
- [Acerca de](./about.md) covers `about`.
- [Biblioteca](./biblioteca.md) covers `biblioteca` and `documentos/listar`.
- [Buscar](./buscar.md) covers `buscar`.
- [Cuenta](./cuenta.md) covers `cuenta`.
- [Mis referencias](./referencias.md) covers `cuenta/referencias`.
- [Mis temas](./temas.md) covers `cuenta/temas` and `cuenta/temas/:id`.
- [Notas](./notas.md) covers `notas`.
- [Estudios](./estudios.md) covers `estudio`, `estudios`, `estudios/:id`, and `estudios/:id/editar`.
- [Aprendizaje](./aprendizaje.md) covers `aprendizaje`.
- [Explorar](./explorar.md) covers `explorar`, `explorar/relaciones`, and `explorar/topicos/:slug`.
- [Ajustes](./ajustes.md) covers `ajustes`.
- [Ficha de documento](./documento.md) covers `documento/:id`.
- [Revisión admin](./admin-revision.md) covers `admin/revision` and `admin/revision/:id`.
- [Padres de la Iglesia](./padres.md) covers `padres` and `padres/:id`.
- [Doctores de la Iglesia](./doctores.md) covers `doctores` and `doctores/:id`.
- [Santoral](./santoral.md) covers `santoral` and `santoral/:id`.
- [Papas](./papas.md) covers `papas` and `papas/:id`.
- [Lectio divina](./lectio.md) covers `lectio`.
- [Lector](./lector.md) covers `leyendo/:documento` and `leyendo/:id/punto/:user`.
