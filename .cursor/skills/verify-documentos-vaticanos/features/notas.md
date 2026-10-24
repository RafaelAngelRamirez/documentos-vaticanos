# Notas

Notas shows highlights, bookmarks, and notes kept on the device. The pages path is `notas`. Tabs are Subrayados, Marcadores, and Notas. An anonymous reader sees the empty tabs without signing in.

## Sub-features

- `notas` is path `notas`.
- `notas-tabs` switches Subrayados, Marcadores, and Notas. The smoke drive proves the title and the first tab label.

## How to get to it (user POV)

- Open `/notas`.
- From Cuenta, choose the notes link.
- The desktop reader chrome links here as markers.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open notes.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive notas`. The text `Notas` is visible.

## Gotchas

- The same word `Notas` is both the screen title and a tab. The drive accepts the first visible match.
- Notes are local (`dv_anotaciones_v1`). A fresh context has an empty list. That is success.
