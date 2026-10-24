# Ficha de documento

The document cover is path `documento/:id`. For `cic-es` it shows the full title, the reading cover, and the start and listen actions. Start opens the lector. Listen opens the same lector with narration requested.

## Sub-features

- `documento/:id` renders `app-reading-cover` for a manifest id.
- `documento-start` is the primary button (Comenzar or Continuar).
- `documento-listen` is the button whose label starts with the listen string.
- `documento-source` shows `{Idioma} · fuente` when `sourceUrl` exists.

## How to get to it (user POV)

- From Biblioteca, open a document. The URL is `/documento/:id`.
- Use the primary button to read, or the listen button to read with the narrator.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the Catechism cover.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive documento`. The URL contains `/documento/cic-es`, `app-reading-cover` is attached, and the text `Catecismo` is visible.

## Gotchas

- Continue versus Comenzar depends on local progress. The drive asserts the title word `Catecismo`, which is in the official title, not a single button label.
- An unknown id shows the cover error state. `cic-es` is required by doctor, so this drive uses that id.
