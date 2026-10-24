# Mis referencias

Mis referencias lists starred citations saved for the account. The pages path is `cuenta/referencias`. With an empty local list the screen says there are no references yet and tells the reader to open a document and use Guardar.

## Sub-features

- `cuenta/referencias` is the empty or filled list.
- `referencias-open` opens a saved row in the lector at that `documentId` and `unitIndex`. The smoke drive does not create a row.

## How to get to it (user POV)

- From Cuenta, choose Mis referencias.
- Open `/cuenta/referencias` directly.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive referencias`. The bar title `Mis referencias` is visible. An empty anonymous list also shows `Aún no tienes referencias`.

## Gotchas

- The title in the template is the literal `Mis referencias`, not an i18n key.
- Rows need a prior save. Absence of rows is the anonymous end state.
