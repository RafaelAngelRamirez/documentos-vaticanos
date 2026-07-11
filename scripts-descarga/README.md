# scripts-descarga

Offline corpus tools and Vatican.va scrapers for **documentos-vaticanos**.

## Multi-source registry (PR5)

Configuration lives in [`config/sources.json`](config/sources.json). Each source has:

| Field | Meaning |
|--------|---------|
| `id` | CLI id (`lg`, `bible`, `catechism`) |
| `corpusDocId` | Folder under `documentos/corpus/documents/` |
| `adapter` | Key in `src/adapters/registry.ts` |
| `seedUrls` | vatican.va entry points |
| `docCode` | Entry in `models/data/doc-codes.json` (e.g. `LG`) |
| `fixturePath` | Offline HTML under `fixtures/` |
| `legacyScript` | Existing npm script when adapter is not live yet |

### Adapters

```
src/adapters/
  types.ts                 SourceAdapter interface
  registry.ts              id → adapter + sources.json loader
  generic_numbered.adapter.ts   shared <p>N. text</p> parser
  lg.adapter.ts            Lumen gentium
  bible.adapter.ts         stub → use npm run biblia
  catechism.adapter.ts     stub → use npm run catecismo
```

`SourceAdapter`:

- `expandSeeds?` — multi-page discovery
- `parsePage` — HTML → TransportData units (`consecutivo`, `contenido`, `referencias`)
- `finalize?` — sort / validate
- `supportsLiveScrape` — when `false`, CLI points at the legacy script

### CLI

```bash
# Live LG scrape → corpus + fixtures + doc-codes
npm run scrape:lg

# Generic entry
npm run scrape -- --source lg
npm run scrape -- --list
npm run scrape -- --source lg --offline          # fixtures/lg-es/source.html
npm run scrape -- --source lg --fixture /path/to.html
npm run scrape -- --source lg --skip-write       # parse only
```

On success, LG writes:

- `../documentos/corpus/documents/lg-es/{content,index,meta}.json`
- `../frontend/src/assets/corpus/documents/lg-es/…` (same)
- merges `manifest.json` (does **not** drop bible/cic)
- sets `doc-codes.json` → `LG.corpusDocId = "lg-es"`
- caches HTML at `fixtures/lg-es/source.html`

Then resolve cross-refs (CIC → LG, etc.):

```bash
npm run resolve:refs
```

Offline pack pipeline (legacy migrate + resolve):

```bash
npm run pipeline:corpus
```

## How to add another magisterial doc (e.g. GS, DV)

1. **Add source** in `config/sources.json`:

```json
{
  "id": "gs",
  "title": "Gaudium et spes",
  "shortTitle": "GS",
  "kind": "magisterium",
  "locale": "es",
  "corpusDocId": "gs-es",
  "docCode": "GS",
  "adapter": "generic_numbered",
  "seedUrls": ["https://www.vatican.va/..._sp.html"],
  "fixturePath": "fixtures/gs-es/source.html",
  "expectedUnitCount": 93
}
```

2. **Doc code** — ensure `models/data/doc-codes.json` has `"code": "GS"` (already present for many Vat. II docs). Leave `corpusDocId: null` until scrape succeeds; the writer sets it.

3. **Adapter** — if the page is numbered `<p>N. …</p>` like LG, reuse `generic_numbered` or copy `lg.adapter.ts`. Register a custom adapter in `registry.ts` only when markup differs.

4. **Scrape**:

```bash
npm run scrape -- --source gs
npm run resolve:refs
```

5. **Frontend** loads whatever is in `manifest.json`; no hard-coded LG list required if the app already iterates the manifest.

## Legacy scripts (unchanged)

```bash
npm run biblia       # full Bible download
npm run catecismo    # full Catechism download
npm run reindex      # rebuild *.index.json from transport JSON
npm run migrate:corpus
npm run resolve:refs
npm run test:refs
```

## Manual fixture path (no network)

1. Save the Vatican HTML page as `fixtures/<id>/source.html`.
2. Point `fixturePath` in `sources.json` (or pass `--fixture`).
3. Run:

```bash
npm run scrape -- --source lg --offline
```

## Lumen gentium notes

- Seed (ES): https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_sp.html
- Single page, charset often iso-8859-1 with entities; fetcher uses `arraybuffer` + latin1.
- Numbered sections **1–69** become `consecutivo` for `resolve:refs` (locatorType `number`).
- Footnote anchors (`#_ftnN`) are stripped; parenthetical citations become `referencias[]` like the catechism.
