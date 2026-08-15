# AGENTS.md — Documentos Vaticanos (app pública)

## Tokens

La fuente canónica es `frontend/src/styles.css`. No hay `design-reading.css` ni `design-product.css`. No reintroducir hex Bootstrap/Material (`#0d6efd`, `#2e7d32`) en componentes.

## Contrato 7B — chrome fijo y safe-area

El chrome fijo (`.reader-dock`, `.rfoot`, `.bnav`, `.fbar`, `.dv-toast`, sheets) **solo** usa `--safe-area-inset-*`. Prohibido `bottom: 0` sin `padding-bottom: var(--safe-area-inset-bottom)`.

`--safe-area-inset-*` = `max(--safe-area-env-*, --safe-area-bridge-*)`.

- `--safe-area-env-*` viene de `env(safe-area-inset-*, 0px)` (iOS / WebView moderno).
- `--safe-area-bridge-*` lo escribe el puente Android (`SafeAreaService` / `docs/android/MainActivity.java` vía `buildApplyInsetsJs`).
- **Nunca** publicar `0,0,0,0` desde el puente: pisa el `env()` real.
- En `html[data-shell=android]` no se anulan insets a 1024px (tablet landscape).

## Narrador

- Pausa/reanuda desde `narrIndex`, no desde el párrafo visible.
- Voces filtradas por locale del pack (`listVoices(locale)`).
- `speech-prep` usa `\p{L}` (CJK / árabe / devanagari).
- Grok es opt-in; si falla, toast «Voces del sistema» y Web Speech.
- Sin pill «Dormir» hasta tener un timer real.

## Portada

Toda ficha de documento abre `/documento/:id`. El lector es `/leyendo/:nombre`.
Listados y buscar muestran `title`; `shortTitle` solo en el chrome corto del lector.
