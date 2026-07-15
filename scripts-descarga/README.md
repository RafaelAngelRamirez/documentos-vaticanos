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

## Crawl discovery (Curia Romana → depth 8)

Separate from the **reading corpus**. Discovers organs + document URLs for offline referenceability.

```bash
# Depth 2 (organs only, quick QA)
npm run crawl -- --seed romancuria-es --max-depth 2

# Full phase target
npm run crawl:romancuria
# or
npm run crawl -- --seed romancuria-es --max-depth 8

# Resume after interrupt
npm run crawl -- --seed romancuria-es --max-depth 8 --resume

# Re-fetch known nodes when content may have changed
npm run crawl:update -- --seed romancuria-es
```

**Outputs** (under repo `documentos/`, not Angular assets):

| Path | Content |
|------|---------|
| `documentos/crawl/<seedId>/graph.jsonl` | One node per URL (depth, pageType, hash) |
| `documentos/crawl/<seedId>/state.json` | Queue + visited + stats (resume) |
| `documentos/crawl/<seedId>/cache/` | HTML by content hash |
| `documentos/organs/<seedId>.json` | Curia organ tree |
| `documentos/discoveries/<seedId>-documents.json` | Docs grouped by family + locales |

**Policy:** allowlist `vatican.va`; prefer **ES**; other languages cataloged without body fetch; external hosts catalog-only; URLs already in reading corpus → `skipped-corpus`.

**Promote to corpus** (later): pick a discovery with `preferredLocale: es` and add a `sources.json` entry / adapter scrape — do not bulk-copy discoveries into `frontend/src/assets/corpus`.

## CDS (Compendio Doctrina Social) & CDC (Código de Derecho Canónico)

```bash
# Live scrape → corpus (idempotent re-scrape: same corpusDocId, no duplicates)
npm run scrape:cds
npm run scrape:cdc

# Offline from fixtures/
npm run scrape -- --source cds --offline
npm run scrape -- --source cdc --offline --force   # sample pages only offline

# Re-scrape even if unitCount << expected
npm run scrape -- --source cds --force
```

| Source | corpusDocId | Units | Notes |
|--------|-------------|-------|-------|
| `cds` | `cds-es` | ~583 | Single page; adapter `cds` |
| `cdc` | `cdc-es` | ~1752 canons | Multi-page (~251); adapter `cdc` |

**Naming:** In this repo `CIC` = **Catecismo** (`cic-es`). The Code of Canon Law uses **`CDC`** (alias `CICL`). Do not reassign `CIC` to the Code.

**Re-scrape catechism (legacy):** `npm run catecismo` then `npm run migrate:corpus` if needed. Prefer not re-running full bible/catechism crawl casually (noisy multi-page).

**Language catalog:** `documentos/registry/source-catalog.json` lists ES + other locales (html/pdf). Only ES bodies are scraped in this phase.

## Concilios ecuménicos (latín → corpus → app)

Misma estructura que Padres: `../documentos/concilios-source/{inventory,pdf,raw,clean}/`.

**Todo lo que sea imagen debe pasar a texto** antes del corpus (la app solo lee JSON).

| Paso | Comando |
|------|---------|
| Listar / importar | `npm run concilios:list` · `concilios:import -- --id nicea-i` |
| Descargar Mansi (Archive.org `*_djvu.txt`) | `npm run concilios:download -- --id nicea-i` |
| PDF texto | `npm run concilios:extract -- --pdf … --out-id nicea-i-la` |
| PDF imagen → OCR | `npm run source:ocr -- --pdf … --doc-id nicea-i-la --source-root concilios-source --lang lat+eng` |
| Recorte desde dump | `npm run concilios:slice -- --id nicea-i` |

OCR genérico: `ocr_volume.sh` (`--source-root padres-source|concilios-source`).  
`kind: council` · locale `la`. Vat. II ES ya en corpus; no reimportar.

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
