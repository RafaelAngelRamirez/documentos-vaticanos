# Santoral

Santoral lists saints and blesseds from the offline pack, with a calendar mode. The list path is `santoral`. A life is `santoral/:id`. The smoke id is `alejandrina-maria-da-costa` from `assets/corpus/santoral/manifest.json`.

## Sub-features

- `santoral` shows `Santoral` and the offline pack count.
- `santoral/:id` opens the person ficha for that id.
- `santoral-calendar` toggles the calendar. The smoke drive stays on the list and the ficha.

## How to get to it (user POV)

- Open `/santoral`.
- Tap an entry. The URL becomes `/santoral/:id`.
- The list copy points at Papas for popes who are also in this pack.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive santoral`. The text `Santoral` is visible.
- **Open one life.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive santoral-detalle`. The text `Alejandrina` is visible.

## Gotchas

- The ficha title is the pack's display name, not the slug. `Alejandrina` matches `alejandrina-maria-da-costa`.
- Calendar cells with no feast show an empty day. That is not a failed list.
