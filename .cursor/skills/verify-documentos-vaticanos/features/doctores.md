# Doctores de la Iglesia

Doctores lists the Doctors of the Church and opens a person ficha. The list path is `doctores`. A person is `doctores/:id`. The smoke person is `agustin-hipona`.

## Sub-features

- `doctores` shows `Doctores de la Iglesia`.
- `doctores/:id` shows `app-person-ficha`. The id `agustin-hipona` is in `frontend/src/app/data/doctores.ts`.

## How to get to it (user POV)

- Open `/doctores` from the desktop link Doctores.
- Tap a name to open `/doctores/:id`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive doctores`. The text `Doctores de la Iglesia` is visible.
- **Open a doctor.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive doctores-detalle`. `app-person-ficha` is attached and the text `Agustín` is visible.

## Gotchas

- Some doctors have no corpus pack. The ficha marks those works as pending. `agustin-hipona` is one that has packs.
- The list lede says there are 38 doctors. Assert the title, not the count, unless you have counted `doctores.ts`.
