# Lector

The lector is the immersive reading surface. There is no bottom nav. Path `leyendo/:documento` opens a document (`ROUTE.leyendo`). Path `leyendo/:id/punto/:user` opens a unit (`ROUTE.punto`). The smoke unit is `/leyendo/cic-es/punto/2`, which shows `app-lector` and at least one `app-punto`.

## Sub-features

- `leyendo/:documento` is the template path `` `${ROUTE.leyendo}/:documento` ``. `ROUTE.leyendo` is `leyendo`.
- `leyendo/:id/u/:unit` is `` `${ROUTE.leyendo}/:id/u/:unit` ``. `openReading` writes this form (`/leyendo/:documentId/u/:unitIndex`).
- `leyendo/:id/punto/:user` is `` `${ROUTE.leyendo}/:id/${ROUTE.punto}/:user` ``. `ROUTE.punto` is `punto`. The smoke drive still opens this route.
- `lector-unit` proves `/leyendo/cic-es/punto/2` with `app-punto` visible and `.bnav` count 0.
- `lector-doc` proves `/leyendo/cic-es` with the same shell.
- `lector-prefs` is the Aa button (`reader.prefs_aria`). The smoke drive does not open the sheet.
- `lector-index` is the desktop wbar Index control (`reader.index`). It opens a `dv-sheet` with `app-doc-toc` (`buildDocumentToc`); it does not call `goBack` or leave `/leyendo/…`. The smoke drive does not open the sheet.

## How to get to it (user POV)

- From a document cover, tap Comenzar or Continuar. The URL becomes `/leyendo/:id/punto/:index` or the document route.
- From a ficha, tap Comenzar la lectura.
- Open `/leyendo/cic-es/punto/2` directly to land on that unit.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open a unit.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector`. The action is `/leyendo/cic-es/punto/2`. The result URL contains `/leyendo/cic-es/u/2`. `app-lector` is attached. `app-punto` is visible. `.bnav` count is 0.
- **Open the document route.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive lector-doc`. The result URL contains `/leyendo/cic-es`. `app-punto` is visible. `.bnav` count is 0.
- **Test.** `yarn test:e2e-reader` covers this route (`e2e/tests/app-reader.spec.ts` opens `/leyendo/cic-es/punto/2`).

## Gotchas

- `.rpaper` is on the shell even while the document is still loading. Wait for `app-punto`, not for `.rpaper`.
- The helper pins `uiLocale` to `es`. Without that pin, Chromium in English renders `Start of the document` from `en.json` instead of `Inicio del documento`.
- The first open of `cic-es` reads a large `content.json`. The helper waits up to 60 seconds. A timeout is a failed drive, not a pass.
- Bars hide on scroll. `.bnav` is absent on this route at every width. Do not confuse a hidden fbar with the product bottom nav.
- A long document (the Catechism from point 1, and the same pattern elsewhere) extends the rendered window forward. Units already off screen are the ones dropped. The viewport stays on the unit that was on screen. The scroll-spy `replaceUrl` does not call `scrollIntoView`. Logic: `frontend/src/app/core/shell/reader-window.logic.ts`.
- `punto/:user` is the legacy unit segment. For this smoke the action is `2`, not a user id. `readingCommands` replaces it with `/u/:unitIndex`. Assert `/leyendo/cic-es/u/2`, not the `punto` URL.
- Canonical address is the route cite (`documentId` + `unitIndex`) stored as the URL, with prefs in `reader.prefs.v1`. Drive fails if localStorage holds `document_id`, `article_selected`, `actual_index`, `dv.settings`, or `dv.pos.*`. Those keys still exist as legacy names in `cite.ts`.
- Drive fails if this page loads four or more `content.json` bodies (`ensureAllLoaded`) or links `design-product.css` / `design-reading.css`. One open document through `ensureWindow` is the canonical load. Styles live in `frontend/src/styles.css`. See `docs/debt-hotspots.md`.
- `.narr` is the device narrator (Web Speech on web, Capacitor TTS on the APK). Play, previous, next and the rate pill are always there when speech exists. The voice pill shows when that document language has at least two device voices. The saved voice is per language (`dv.narr.prefs.v1`, `voiceByLang`) and is the same preference Ajustes cycles for the UI language. Grok stays out of this bar.
- A closed foot disclosure says `Vocabulario parecido`. It sits above the narrator and the mobile position bar, outside `.rtxt`. Arrival leaves it closed, so the smoke drive does not open it and does not load the related hub pool. Opening it ranks the visible paragraph (cap 4, passage gate, hub pool of 40). A row calls `openReading` with `stack: 'push'`. Back closes this disclosure before the citation stack. A real citation in the paragraph stays on the citation modal; this disclosure is not a sheet.
- Text selection (4A) shows `.selpop` (Subrayar / Nota / Copiar / Compartir). On Chrome Android and Capacitor Android the app clears the native `Selection` after capturing the excerpt so the browser ActionMode does not stack on `.selpop`; copy still uses the held excerpt. Desktop fine-pointer keeps the live selection. Logic: `frontend/src/app/core/reading/selection-menu.logic.ts`.
- A tap on an in-text citation opens the Lectura rápida sheet with only the cited units (`resolveCitedPassageFromLocalRef` + `app-pasaje`). The route stays on the current lector URL; back closes the sheet. Bible and doc-to-doc refs share that path. Hydration is `CorpusService.ensureForCitedPassage` (cite-map / ensureWindow), not a full bible `ensureLoaded`. Day readings on Inicio/Lectio use the same resolver via `resolveCitedPassageFromCite`.
- An English footnote with no stored destination (`Mt 5:12`, `Gen 17:1` in Gaudete et exsultate) is still a link (`data-testid="bible-cite"`). Indexes come from the Spanish cite-map. The verse text is the reader's bible pack (`biblePackIdForLocale`). The number next to the verse is the one the label cites (`12` for `Mt 5:12`), not a stale `biblia.versiculo` or the unit `consecutivo`. A label with no book (`12:1`) stays `ref-unresolved`. The Spanish twin of that paragraph already has `local` and keeps that path.
- The wbar Index button must open the index sheet on the current lector URL. Wiring it to `goBack()` returned to `/documento/:id` (Rafa Amoris EN v0.0.70). Canonical: `toggleIndex` → `buildDocumentToc` → `openReading` with `stack: 'keep'`.
- Amoris laetitia (EN/ES) has numbered paragraphs only: TOC comes from `CURATED_TOC_OVERRIDES` chapter starts, not heading detection.
- Bible EN drops `biblia` in the packed body. Index uses the Spanish cite-map (`buildBibleTocFromCiteMap` / `ensureCiteMap`). Headers stamp the same map so title units are not «Nº 0».
- A patristic cite already in the offline corpus opens that same sheet when the passage can be cut out: `De Incarnatione` by section (`atanasio-de-incarnatione-en`) and `Carta a Diogneto` by chapter (`carta-diogneto-es`). `Confessiones` and `De Trinitate` open the NPNF paragraph (`npnf-agustin-confesiones-en`, `npnf-agustin-de-trinitate-en`) by book, chapter and paragraph. The link is `[data-testid="patristic-cite"]`. `PG` / `PL` sits in the closed “Edición” disclosure. A BAC volume whose paragraph cannot be isolated stays plain text. The sheet does not open the whole work.
