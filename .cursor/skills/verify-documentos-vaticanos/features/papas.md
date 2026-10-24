# Papas

Papas lists the 267 Roman pontiffs from the vatican.va list and opens a ficha. The list path is `papas`. A pope is `papas/:id`. The smoke id is `pedro` from `assets/corpus/papacy/manifest.json`.

## Sub-features

- `papas` shows the lede `Los 267 pontífices` and a filter.
- `papas/:id` shows `app-person-ficha` for that pope.
- `papas-saint` links to `/santoral/:id` when `saintId` is set. The smoke drive does not follow it.

## How to get to it (user POV)

- Open `/papas` from the desktop link Papas.
- Search or tap a name to open `/papas/:id`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the list.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive papas`. The text `267 pontífices` is visible.
- **Open Peter.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive papas-detalle`. `app-person-ficha` is attached and the text `Pedro` is visible.

## Gotchas

- The count line `{{ total }} pontífices` appears after the pack loads. The lede already contains `267 pontífices`, so the drive does not wait on `total`.
- Citations of a pope's documents use `documentId` and `unitIndex`, not `popeId`.
