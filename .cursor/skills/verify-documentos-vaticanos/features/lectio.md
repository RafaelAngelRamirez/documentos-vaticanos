# Lectio divina

Lectio divina is the prayer screen for today's Gospel. The pages path is `lectio`. The heading is `Lectio divina`. The first screen is the citation, Leer el Evangelio, Escuchar, and the cited verses, then a short offline reflection that changes with the liturgical day. Liturgical detail, the longer extract, and the five steps from Verbum Domini sit in a closed section.

## Sub-features

- `lectio` is path `lectio` and shows `lectio.title`.
- `lectio-gospel` shows `data-testid="lectio-gospel-read"` when a Gospel exists.
- `lectio-empty` shows `data-testid="lectio-no-gospel"` on a day the pack has no Gospel.
- `lectio-reflection` shows `data-testid="lectio-reflection"` and `lectio-reflection-attr` without opening the closed section.
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
- The liturgical label, the longer extract (`lectio-deep`), and the five steps are inside the closed `details` `data-testid="lectio-more"`. The heading, the passage, and the short reflection stay visible without opening it.
- The short reflection is a literal extract from Verbum Domini or the Letter to Diognetus, already in the corpus. The attribution sits under the quote. It changes with the liturgical day.
- Vatican News is an extra inside that section, and only when the saved cache `dateIso` is today. Its commentary is not packed. The offline reflection still renders without a network.
