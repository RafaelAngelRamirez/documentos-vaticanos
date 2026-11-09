# Notas

Notas shows highlights, bookmarks, and notes kept on the device. The pages path is `notas`. Tabs are Subrayados, Marcadores, and Notas. An anonymous reader sees the empty tabs without signing in.

## Sub-features

- `notas` is path `notas`.
- `notas/repaso` is path `notas/repaso`. It is the device review queue. The smoke drive does not open it.
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
- A stored note without `updatedAt` is stamped from `createdAt` (`fillAnotacionUpdatedAt` in `frontend/src/app/services/anotaciones.logic.ts`). Cloud merge (`anotacionMergePlan` in `backend/src/routes/sync-anotacion.logic.ts`) writes the device text when the clocks tie and the text differs. New rows go in one `createMany`; updates share that transaction. This anonymous drive does not sign in and does not call `POST /sync/merge`. The checks are `npm --prefix frontend run test:anotaciones` and `npm --prefix backend run test:sync-anotacion`.
