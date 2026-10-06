# Biblioteca

Biblioteca lists the offline corpus. The reader can filter by kind and open a document cover. The legacy path `documentos/listar` (`ROUTE.list_documents`) redirects to `/biblioteca`.

## Sub-features

- `biblioteca` is the path `biblioteca` and the list screen.
- `documentos/listar` is `ROUTE.list_documents`. It redirects to `/biblioteca`.
- `biblioteca-search` filters the list with the search field whose accessible name is the library placeholder.

## How to get to it (user POV)

- Tap Biblioteca in the bottom nav, or the desktop link Biblioteca.
- On Inicio, tap Empezar.
- Open `/documentos/listar`. The address becomes `/biblioteca`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive biblioteca`. The text `Biblioteca` is visible.
- **Legacy redirect.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive biblioteca-redirect`. The result URL contains `/biblioteca` and the text `Biblioteca` is visible.

## Gotchas

- The list waits on `manifest.json`. Doctor already requires `cic-es`. A drive that only checks the heading can pass before rows render. Open a document cover to prove a row.
- The redirect is `redirectTo: '/biblioteca'`. Assert the URL, not a second copy of the list component.
