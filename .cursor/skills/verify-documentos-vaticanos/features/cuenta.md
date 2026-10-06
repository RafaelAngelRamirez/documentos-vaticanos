# Cuenta

Cuenta is the access screen when nobody is signed in, and the profile when a session exists. Without `apiBaseUrl` the anonymous screen states that the API is not configured and that offline reading still works. The pages path is `cuenta`.

## Sub-features

- `cuenta-anon` is path `cuenta` with no session. It shows `account.api_missing` when the API is off.
- `cuenta-profile` is the same path with `auth.user`. It shows the name and links to notes, references, themes, and study.
- `cuenta-google` shows `Continuar con Google`. It stays disabled while the API is off.

## How to get to it (user POV)

- Open `/cuenta`.
- Tap the account dot in the desktop bar.
- From Ajustes, the anonymous profile row leads toward access.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Anonymous account.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive cuenta`. The text `API no configurada. El lector offline sigue disponible.` is visible. That string is `account.api_missing` in `es.json`.

## Gotchas

- A packaged static server has no API. The Google button is disabled. Do not call that a failed login.
- With `bash scripts/dev.sh` and `DEV_AUTH_BYPASS`, the email form can appear. This drive does not submit it.
- Admin routes redirect here when there is no session. That landing is not a successful look at the profile card.
