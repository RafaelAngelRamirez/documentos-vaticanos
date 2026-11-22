# Padres de la Iglesia

Padres lists Church Fathers by era and opens a person ficha. The list path is `padres`. A person is `padres/:id`. The ficha for `agustin-hipona` includes Comenzar la lectura when a primary work exists.

## Sub-features

- `padres` shows `Padres de la Iglesia` and `app-era-list`.
- `padres/:id` shows `app-person-ficha`. The smoke id is `agustin-hipona` from `frontend/src/app/data/padres.ts`.
- `padres-read` is the button `Comenzar la lectura` on that ficha.

## How to get to it (user POV)

- Open `/padres` from the desktop link Padres.
- Tap a name. The URL becomes `/padres/:id`.
- On the ficha, tap Comenzar la lectura or the listen control to open the lector.
- On `agustin-hipona`, tap `Confesiones, I, 1` or the rows Confesiones and De Trinitate. The ficha shows that NPNF paragraph. The URL stays on `/padres/agustin-hipona`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive padres`. The text `Padres de la Iglesia` is visible.
- **Open Augustine.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive padres-detalle`. `app-person-ficha` is attached and `Comenzar la lectura` is visible.

## Gotchas

- The desktop heading is `h2.h2.only-desktop`. At 1280px it is visible. On a narrow viewport the fbar carries the same i18n string.
- Comenzar la lectura is omitted when `primaryWorkId` is missing. `agustin-hipona` has works in `padres.ts`. It still opens the first work (`agustin-01-primeros-escritos-es`).
- Confesiones and De Trinitate on that ficha are buttons (`data-testid="obra-cite"`). They open the NPNF paragraph through `citedPassageForPatristic`, not the BAC volume. The quote source is `data-testid="quote-cite"`.
