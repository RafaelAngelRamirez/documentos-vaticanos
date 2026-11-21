# Lectio divina

Lectio divina is the prayer screen for today's Gospel. The pages path is `lectio`. The heading is `Lectio divina`. The first screen is the citation, Leer el Evangelio, Escuchar, and the cited verses. Liturgical detail, the reflection, and the five steps from Verbum Domini sit in a closed section.

## Sub-features

- `lectio` is path `lectio` and shows `lectio.title`.
- `lectio-gospel` shows `data-testid="lectio-gospel-read"` when a Gospel exists.
- `lectio-empty` shows `data-testid="lectio-no-gospel"` on a day the pack has no Gospel.
- `lectio-steps` shows the five step names after opening `data-testid="lectio-more"`.
- `lectio-more` is that closed section. Its summary is `Detalle del día`.

## How to get to it (user POV)

- On Inicio, choose Abrir lectio de hoy.
- Open `/lectio` directly.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open lectio.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lectio`. The heading `Lectio divina` is visible. The drive waits until `lectio-gospel-excerpt` or `lectio-no-gospel` is attached.

## Gotchas

- Gospel presence depends on the date and the packaged lectionary. The heading is the stable proof. A missing Gospel is `lectio.no_gospel`, not a broken route.
- The gospel block lists only the verses named in the citation. A jump (`Ap 3,1-6.14-22`) leaves out the verses in the gap. Escuchar speaks that same list. Leer and Escuchar stay on `/lectio` and do not open `/leyendo`.
- The liturgical label, the reflection, and the five steps are inside the closed `details` `data-testid="lectio-more"`. The heading `Lectio divina` and the passage stay visible without opening it.
- Vatican News reflection text is enrichment inside that section. The offline steps still render without a network.
