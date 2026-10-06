# Lector

The lector is the immersive reading surface. There is no bottom nav. Path `leyendo/:documento` opens a document (`ROUTE.leyendo`). Path `leyendo/:id/punto/:user` opens a unit (`ROUTE.punto`). The smoke unit is `/leyendo/cic-es/punto/2`, which shows `app-lector` and at least one `app-punto`.

## Sub-features

- `leyendo/:documento` is the template path `` `${ROUTE.leyendo}/:documento` ``. `ROUTE.leyendo` is `leyendo`.
- `leyendo/:id/punto/:user` is `` `${ROUTE.leyendo}/:id/${ROUTE.punto}/:user` ``. `ROUTE.punto` is `punto`.
- `lector-unit` proves `/leyendo/cic-es/punto/2` with `app-punto` visible and `.bnav` count 0.
- `lector-doc` proves `/leyendo/cic-es` with the same shell.
- `lector-prefs` is the Aa button (`reader.prefs_aria`). The smoke drive does not open the sheet.

## How to get to it (user POV)

- From a document cover, tap Comenzar or Continuar. The URL becomes `/leyendo/:id/punto/:index` or the document route.
- From a ficha, tap Comenzar la lectura.
- Open `/leyendo/cic-es/punto/2` directly to land on that unit.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open a unit.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector`. The result URL contains `/leyendo/cic-es/punto/2`. `app-lector` is attached. `app-punto` is visible. `.bnav` count is 0.
- **Open the document route.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector-doc`. The result URL contains `/leyendo/cic-es`. `app-punto` is visible. `.bnav` count is 0.

## Gotchas

- `.rpaper` is on the shell even while the document is still loading. Wait for `app-punto`, not for `.rpaper`.
- The helper pins `uiLocale` to `es`. Without that pin, Chromium in English renders `Start of the document` from `en.json` instead of `Inicio del documento`.
- The first open of `cic-es` reads a large `content.json`. The helper waits up to 60 seconds. A timeout is a failed drive, not a pass.
- Bars hide on scroll. `.bnav` is absent on this route at every width. Do not confuse a hidden fbar with the product bottom nav.
- `punto/:user` is the unit index segment. For this smoke it is `2`, not a user id.
