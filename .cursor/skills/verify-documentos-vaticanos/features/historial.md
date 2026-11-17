# Historial

Historial lists documents opened on this device, newest first. The page path is `historial`. A tap reopens that document at the stored unit. The list lives in `dv.readingHistory.v1` on the device. A fresh context is empty.

## Sub-features

- `historial` is path `historial`.
- `history-item` is one row (`data-testid="history-item"`, `data-document-id`).
- `history-clear` removes the device list (`data-testid="history-clear"`). The smoke drive does not press it.
- `history-empty` is the empty state (`data-testid="history-empty"`).

## How to get to it (user POV)

- On a phone, tap Historial in the bottom nav.
- Open `/historial`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open history.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive historial`. The text `Historial` is visible. The empty state is attached.

## Gotchas

- The reader writes a row when a unit is on screen (`NavigationService.noteVisible`). The cover alone does not.
- One row per document. Opening it again moves that row to the top and keeps the first `openedAt`.
- The phone smoke that opens two documents and reopens one is `npx playwright test --project=mobile-390` (`e2e/tests/mobile-viewport.spec.ts`).
- Clearing history does not delete `dv.lastRead` and does not touch the corpus.
