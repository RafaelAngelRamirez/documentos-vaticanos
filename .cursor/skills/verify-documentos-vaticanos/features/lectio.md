# Lectio divina

Lectio divina is the prayer screen for today's Gospel. The pages path is `lectio`. The heading is `Lectio divina`. It offers Leer el Evangelio and Escuchar when the packaged lectionary has a Gospel, and the five steps from Verbum Domini.

## Sub-features

- `lectio` is path `lectio` and shows `lectio.title`.
- `lectio-gospel` shows `data-testid="lectio-gospel-read"` when a Gospel exists.
- `lectio-empty` shows `data-testid="lectio-no-gospel"` on a day the pack has no Gospel.
- `lectio-steps` shows the five step names.

## How to get to it (user POV)

- On Inicio, choose Abrir lectio de hoy.
- Open `/lectio` directly.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open lectio.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lectio`. The heading `Lectio divina` is visible.

## Gotchas

- Gospel presence depends on the date and the packaged lectionary. The heading is the stable proof. A missing Gospel is `lectio.no_gospel`, not a broken route.
- Vatican News reflection text is enrichment. The offline steps still render without a network.
