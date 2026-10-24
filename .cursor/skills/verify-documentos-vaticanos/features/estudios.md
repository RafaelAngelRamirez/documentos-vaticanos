# Estudios

Estudios is the study hub. Paths `estudio` and `estudios` render the same screen and, with no session, the greeting `Estudio`. A published study is `estudios/:id`. The editor is `estudios/:id/editar` and shows `Editar estudio` only after the study loads.

## Sub-features

- `estudio` and `estudios` both mount `EstudiosComponent`.
- `estudios/:id` is the detail. Anonymous and offline, the title stays hidden when `study` never arrives.
- `estudios/:id/editar` is the editor. The heading `Editar estudio` is inside `*ngIf="!loading && study"`.

## How to get to it (user POV)

- Tap Estudio in the bottom nav. It navigates to `/estudios`.
- The desktop link Estudio goes to `/estudio`.
- Open a plan to reach `/estudios/:id`, then Editar for `/estudios/:id/editar` when you own it.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Hub alias estudio.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive estudio`. The text `Estudio` is visible.
- **Hub alias estudios.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive estudios`. The text `Estudio` is visible.
- **Missing detail.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive estudios-detalle`. The result URL contains `/estudios/verify-missing`.
- **Missing editor.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive estudios-editar`. The result URL contains `/estudios/verify-missing/editar`.

## Gotchas

- Detail and editor do not render an error line when `study` is null. Seeing `app-root` and the URL is the offline proof of the route, not proof of a loaded plan.
- The hub still calls `listPublished()`. A failed API sets `error` and can paint it next to the greeting. The greeting remains the stable anonymous proof.
- Bottom nav goes to `/estudios`, not `/estudio`.
