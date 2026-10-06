# Mis temas

Mis temas lists the reader's themes. Public themes go through review. Private themes stay local. The list path is `cuenta/temas`. A single theme is `cuenta/temas/:id`.

## Sub-features

- `cuenta/temas` shows the list and the sentence about public review.
- `cuenta/temas/:id` opens one theme when the id exists in local storage or the API.
- `temas-missing` opens `cuenta/temas/verify-missing`. Without that id the title block stays hidden because it is inside `theme as t`.

## How to get to it (user POV)

- Open `/cuenta/temas`.
- Tap a theme row to open `/cuenta/temas/:id`.
- The desktop bar link Temas points at the list.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive temas`. The title `Mis temas` is visible.
- **Missing id.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive temas-detalle`. The result URL contains `/cuenta/temas/verify-missing` and `app-root` is attached. Do not require the theme title.

## Gotchas

- The detail template renders the title only when `theme` is set (`tema-detalle.component.html`). A failed load stores `error` but the read-mode error line sits inside that same `theme` block, so the anonymous missing id looks almost empty.
- Creating a theme is a mutation. The smoke drive does not do it.
