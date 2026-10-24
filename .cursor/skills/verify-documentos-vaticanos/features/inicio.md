# Inicio

Inicio is the welcome screen. It shows the mark DV, the button Empezar, today's ferial readings when the lectionary pack has them, and a link into Lectio divina. An unknown URL inside the pages router lands here.

## Sub-features

- `inicio` opens `ROUTE.inicio`, which is the path `inicio`.
- `inicio-readings` lists `data-testid="inicio-lecturas"` and a Leer or Escuchar button when the day has readings.
- `inicio-lectio` shows the block `data-testid="inicio-lectio"`.
- `wildcard` is the pages route `**`, which redirects to `/inicio`.

## How to get to it (user POV)

- Open `/inicio`.
- Tap Empezar. The app goes to the library.
- Tap a reading's Leer button when the list is present. The lector opens that unit.
- Open any unknown path such as `/no-such-verify-route`. The pages catch-all sends you to Inicio.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open inicio.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive inicio`. The URL contains `/inicio`, the mark `.mark` is present, and the button text `Empezar` is visible (`inicio.start`).
- **Unknown path.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive wildcard`. The result URL contains `/inicio` and `Empezar` is visible.

## Gotchas

- `/` is the empty parent route in `app-routing.module.ts`, not a pages path. The pages catch-all is `**`.
- Readings are date-dependent. An empty `data-testid="inicio-lecturas-empty"` is a valid day outside Ordinary Time. Do not fail the welcome screen for that.
- Empezar is a button, not a link. The drive asserts the label, not a URL change.
