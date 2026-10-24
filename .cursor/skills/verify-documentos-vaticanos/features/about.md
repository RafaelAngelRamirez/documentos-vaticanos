# Acerca de

Acerca de shows the product title and a short description of the offline reader. The pages path is `about` (`ROUTE.about`).

## Sub-features

- `about` opens `ROUTE.about`, path `about`, and shows the heading from `about.title`.

## How to get to it (user POV)

- Open `/about`.
- There is no bottom-nav item for this screen. Use the URL or an in-app link that points here.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open about.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive about`. The heading text is `Acerca de`.

## Gotchas

- The visible title comes from i18n. A non-Spanish `uiLocale` changes the string. The drive assumes the default catalog.
