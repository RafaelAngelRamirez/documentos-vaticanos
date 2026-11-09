# Buscar

Buscar is the corpus search screen. The pages path is `buscar`. The field's accessible name is `Búsqueda en el texto: palabra, frase o intención`. The title in the bar is `Buscar`.

## Sub-features

- `buscar` opens path `buscar` and shows the search field.
- `buscar-query` types a word and shows matches or an empty state. The helper's smoke drive only proves the field is present.

## How to get to it (user POV)

- Open `/buscar`.
- Use the desktop search entry that routes here, or type the URL.
- Submit a word. Results list document titles the user can open.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open search.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive buscar`. The title `Buscar` is visible and the field `[aria-label="Búsqueda en el texto: palabra, frase o intención"]` is attached.
- **Test.** `yarn test:search-load` covers the load contract (`ensureIndexForLocale` on a query, no `ensureAllLoaded`). The smoke drive does not submit a query.

## Gotchas

- Search may load a large index after the shell paints. The drive waits for the field, not for a hit list.
- Do not treat the library filter on `/biblioteca` as this screen.
- Canonical open is `loadManifest` only. A query uses `ensureIndexForLocale`, then `ensureLoadedMany` for the hits. Drive fails if the smoke loads four or more `content.json` bodies (`ensureAllLoaded` is still on `CorpusService`, deprecated), if legacy cursor keys are written, or if `design-product.css` / `design-reading.css` is linked. Do not copy `margin-left: auto` from `.wsearch` in `wbar.component.ts`; the canonical inset is `margin-inline-start: auto`. That physical margin is existing debt and is not a Drive failure yet. See `docs/debt-hotspots.md`.
