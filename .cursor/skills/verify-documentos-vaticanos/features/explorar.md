# Explorar

Explorar is the offline index of masters, topics, epochs, and citation relations. Paths are `explorar`, `explorar/relaciones` (same component, relations tab), and `explorar/topicos/:slug` for one corpus topic.

## Sub-features

- `explorar` opens the hub. The fbar title is `Explorar` on narrow widths. Desktop still mounts the tab row.
- `explorar/relaciones` opens the same component on the relations tab.
- `explorar/topicos/:slug` opens one topic. The smoke id is `aborto`, from `assets/corpus/search/es/topics.json`.

## How to get to it (user POV)

- Open `/explorar`.
- Choose the Relaciones tab, or open `/explorar/relaciones`.
- Open a topic chip. The URL becomes `/explorar/topicos/:slug`.

## Driving it with dv-verify

Preconditions:

- `dv-verify.mjs doctor` printed `doctor ok` for this run's base URL.
- The browser context is a fresh anonymous session (the helper does this).
- UI locale is the default Spanish catalog (`frontend/src/assets/i18n/es.json`).

- **Open the hub.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive explorar`. The text `Explorar` is visible.
- **Relations route.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive explorar-relaciones`. The text `Explorar` is visible and the URL contains `/explorar/relaciones`.
- **Topic.** Run `node .cursor/skills/verify-documentos-vaticanos/scripts/dv-verify.mjs drive explorar-topico`. The text `aborto` is visible (label or slug).

## Gotchas

- `explorar/relaciones` is a route, not only a tab click. Both land on `ExplorarComponent`.
- A missing slug shows `No encontramos este tema en el catálogo offline.` The id `aborto` is a real slug. Do not substitute a slug you have not seen in `topics.json`.
- The relations graph can be empty for a locale whose `doc-graph.json` is missing. The hub title is still the route proof.
