# Ajustes

Ajustes holds reading preferences, UI language, content language, and notification toggles. The pages path is `ajustes`. Without a session the profile row says `Sin sesión` and that reading works without an account. The language control is `data-testid="ajustes-ui-locale"`.

## Sub-features

- `ajustes` is path `ajustes`.
- `ajustes-locale` is the UI language control `data-testid="ajustes-ui-locale"`.
- `ajustes-content-locale` is `data-testid="ajustes-content-locale"`.
- `ajustes-anon` shows `settings.no_session` (`Sin sesión`).

## How to get to it (user POV)

- Tap Ajustes in the bottom nav.
- Open `/ajustes`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open settings.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive ajustes`. The title `Ajustes` is visible and `[data-testid="ajustes-ui-locale"]` is attached.

## Gotchas

- Theme changes write `reader.prefs.v1` in that browser context only. The drive does not click a theme.
- The fbar title is the proof at 1280px. Do not require the mobile-only bottom nav to be visible. `styles.css` hides `.bnav` from 1024px up.
