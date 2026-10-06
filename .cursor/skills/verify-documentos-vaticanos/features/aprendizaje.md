# Aprendizaje

Aprendizaje shows the active course for a signed-in reader. The pages path is `aprendizaje`. Without a session the screen says to sign in and offers Ir a acceso.

## Sub-features

- `aprendizaje` is path `aprendizaje`.
- `aprendizaje-anon` shows `Inicie sesión para ver su curso activo.`
- `aprendizaje-course` shows the course title only when `auth.isLoggedIn` and a study loads.

## How to get to it (user POV)

- Open `/aprendizaje`.
- From Cuenta, follow the aprendizaje link.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Anonymous learning.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive aprendizaje`. The text `Inicie sesión para ver su curso activo.` is visible.

## Gotchas

- The course card is not reachable in the anonymous drive. Do not report it as verified from the sign-in prompt.
- The fbar title `Aprendizaje` is `only-mobile`. At 1280px the sentence above is the stable proof.
