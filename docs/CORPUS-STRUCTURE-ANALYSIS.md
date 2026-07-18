# Corpus structure & compression analysis

**Date:** 2026-07-18  
**Branch context:** `typescript-migration`  
**Scope:** How downloaded / scraped corpus files are laid out, shipped offline, and where safe compression is possible without losing legibility or offline-first reading/search.  
**Non-goal of this document:** implement any compression, single-root migration, or format change (analysis only).

Evidence snapshot: workspace sizes and dual-root hashes were captured under the implementer audit log for this goal run (`corpus-structure-audit.txt`).

---

## 1. Path map (role · size · git)

Four compression dimensions are kept separate below: **tree depth / layout**, **duplicate roots**, **on-disk bytes**, **git weight**, **runtime payload**. Mixing them leads to false “free” wins.

| Path | Role | Approx size (workspace) | Git-tracked? | Notes |
|------|------|-------------------------|--------------|--------|
| `frontend/src/assets/corpus/` | **Ship** (Angular assets → PWA / APK / Electron) | **184 MiB** | **Yes** (376 files) | Runtime root: `assets/corpus`. Lazy via ngsw `assets/**`. |
| `documentos/corpus/` | **Canonical pack root** (pipeline source of truth + OCR tooling) | **184 MiB** | **Yes** (471 files) | Same documents as assets **byte-identical** (375 pairs). Extra: OCR inventories, revisions, queues (~95 files). |
| `scripts-descarga/documentos/` | **Intermediate / work copy** | **187 MiB** | **No** (`.gitignore`) | Flat `{id}.json` + `{id}.index.json` written by `writeCorpusDocument`. Not shipped. |
| `documentos/registry/` | **Catalog** of downloads | 112 KiB | Yes | `downloaded-documents.json`, `source-catalog.json`. Not in app pack. |
| `documentos/discoveries/` | Crawl **discovery** output | 26 MiB | Yes (1 large JSON) | Curia document list; not offline reader pack. |
| `documentos/crawl/` | Crawl **HTML cache** + graph | **1.3 GiB** | Almost no (cache ignored; 2 tracked) | `**/cache/` gitignored. Intermediate only. |
| `documentos/padres-source/` | Source pipeline (pdf → raw → clean) | **2.2 GiB** total | Partial | **Tracked:** `clean/` (~87 MiB) + inventory. **Ignored:** `pdf/` (~2.0 GiB), `raw/` (~91 MiB). |
| `documentos/concilios-source/` | Same pipeline for councils | **56 MiB** total | Partial | **Tracked:** `clean/` (~0.4 MiB) + inventory. **Ignored:** `pdf/`, `raw/` (~56 MiB raw on disk). |
| `scripts-descarga/fixtures/` | Offline scrape fixtures | 7.3 MiB | Yes | HTML/txt for re-runs; not ship pack. |
| `documentos/corpus/revisions/` | OCR repair audit | 392 KiB | Yes (91 files) | Pipeline only; not under assets. |
| `frontend/dist/.../assets/corpus` | **Build artifact** | 184 MiB | No (`frontend/dist/`) | Copy of ship pack after `ng build`. |
| `dist/web/assets/corpus` | **Package artifact** | 184 MiB | No (`/dist`) | CI package output. |
| `frontend/android/.../public/assets/corpus` | **Capacitor copy** | 184 MiB | Built, not source of truth | Same 184 MiB pack inside APK assets. |

### Per-document ship layout (legible, depth 4)

```text
assets/corpus/
  manifest.json                          # DocumentMeta[] + version
  documents/<documentId>/
    content.json                         # Article[] / units (reading body)
    index.json                           # { indice, indice_por_punto } offline search
    meta.json                            # DocumentMeta mirror (NOT fetched by UI)
```

125 documents × 3 JSON files = 375 body files + `manifest.json` (+ OCR-only extras only under `documentos/corpus/`).

### Kind mix (one pack, by on-disk size)

| kind | Docs (manifest) | Size |
|------|-----------------|------|
| patristic | 45 | **154.1 MiB** (~85% of pack) |
| bible | 1 | 15.9 MiB |
| magisterium | 34 | 5.4 MiB |
| catechism | 1 | 3.3 MiB |
| canon-law | 2 | 2.4 MiB |
| council | 42 | 0.6 MiB |

**Largest docs:** `bible-pueblo-de-dios-es` (~15.9 MiB), then Augustine volumes ~4–5.3 MiB each. Median doc ~0.09 MiB; mean ~1.45 MiB (skewed by Patristic + Bible).

---

## 2. Offline pack contract (as consumed)

### 2.1 Schema (aligned models)

- Pipeline: `scripts-descarga/models/corpus.model.ts`
- App: `frontend/src/app/core/corpus/corpus.models.ts` (+ pure engine shapes in `corpus-load.logic.ts`)

`DocumentMeta` requires stable:

| Field | Role |
|-------|------|
| `id` | Stable document id (`cic-es`, `lg-es`, …) — **citas** key part 1 |
| `bodyPath` | Relative path to units JSON (e.g. `documents/lg-es/content.json`) |
| `indexPath` | Relative path to search index JSON |
| `unitCount` | Optional; used in durable **fingerprint** |
| `title` / `shortTitle` / `kind` / `locale` / `sourceUrl` / … | Catalog & UI |

Units in `content.json` keep Article shape: `consecutivo`, `contenido`, optional `referencias`, optional `biblia`.  
**Citas estables:** `documentId` + **`unitIndex`** (array index in `content.json`, stamped as `index_array` on load). Do not reindex units casually.

### 2.2 Runtime load path (shipped)

Constants in `corpus-load.logic.ts`:

```text
CORPUS_ROOT  = 'assets/corpus'
MANIFEST_URL = 'assets/corpus/manifest.json'
```

`CorpusService` → `CorpusLoadEngine` + `IndexedDbCorpusStore` (`dv-corpus-v1`).

**Load order for a document:**

1. **In-memory** cache (`Map` by id/title/shortTitle).
2. **IndexedDB** if fingerprint matches (`id|bodyPath|indexPath|unitCount`).
3. **HTTP/asset fetch:** `resolveAssetPath(bodyPath)` and `resolveAssetPath(indexPath)` → full body + full index JSON.
4. Stamp `index_array` on every unit; **write-through** to IDB.

Manifest: network/assets first; on failure, IDB-stored manifest.  
**`meta.json` is never requested** by the frontend (grep: no `meta.json` under `frontend/src`). Catalog is entirely `manifest.json`.

### 2.3 PWA / packaging

- `ngsw-config.json`: `/assets/**` is **lazy** install, prefetch on update — full pack is **not** forced at first install; first open of a book downloads/caches that JSON.
- Electron static server serves the same `assets/corpus/**` tree.
- Capacitor / Android and `dist/web` embed the full assets tree at build time (~184 MiB corpus alone).

### 2.4 What must stay intact for offline-first

| Capability | Required on device |
|------------|--------------------|
| Catalog / library list | `manifest.json` (or IDB copy) |
| Read a book offline after first open | That doc’s `content.json` (+ SW/IDB) |
| Full-text search offline | That doc’s `index.json` (`indice` term→unit indexes) |
| Navigate by point number | `indice_por_punto` and/or `consecutivo` + array order |
| Citas / notes / themes | Stable `documentId` + `unitIndex` (array order) |

Dropping `index.json` saves ~**71 MiB per pack root** but **breaks offline search**. Rebuilding index client-side is possible in theory (same algorithm as `build_index.ts`) but costs CPU/memory on large Patristic volumes and is not current product behavior.

---

## 3. Redundancy quantified (workspace, not guesses)

### 3.1 Dual ship roots (largest structural duplicate)

| Metric | Value |
|--------|-------|
| `documentos/corpus` | 184 MiB |
| `frontend/src/assets/corpus` | 184 MiB |
| Document file pairs MD5-equal | **375 same, 0 diff** |
| Manifest docs | 125 both; field-identical; only `generatedAt` timestamps differ by ~50 ms |
| Git tracked bytes (both trees) | ~**366 MiB** working tree; history blobs larger |

Writer still dual-writes:

```text
CORPUS_ROOTS = [
  documentos/corpus,
  frontend/src/assets/corpus,
]
```

in `scripts-descarga/src/pipeline/write_corpus.ts`. Also dual-write: `resolve_refs.ts`, `repair_ocr_noise_corpus.ts`, `repair_ocr_punctuation_corpus.ts`, `fix_bible_labels.ts`.

**Single-root is not free:** Angular build only ships `src/assets`. Removing `documentos/corpus` requires either (a) treating assets as sole canonical root, or (b) build-time copy from one root → assets. Today both are tracked in git, so every pack change costs **2×** checkout/history size.

### 3.2 Work copies (`scripts-descarga/documentos/`)

| Metric | Value |
|--------|-------|
| Size | **187 MiB** |
| Files | 256 (flat `*.json` / `*.index.json`) |
| Git | **ignored** |
| Relation | Near-duplicate of content+index; legacy/work naming (e.g. `biblia_pueblo_de_Dios.json`) |

Safe local cleanup for disk; **zero** impact on offline app if regenerated by scrape.

### 3.3 Build / device copies of the same pack

| Copy | Size |
|------|------|
| Source assets | 184 MiB |
| `frontend/dist/.../assets/corpus` | 184 MiB |
| `dist/web/assets/corpus` | 184 MiB |
| Android Capacitor public assets | 184 MiB |

These are **build products**, not source redundancy in git (dist ignored). They still inflate local disk and APK/web artifact size **1:1** with the pack.

### 3.4 Inside one pack: content vs index vs meta

| File type | Bytes | Share of pack |
|-----------|-------|----------------|
| `content.json` | **110.3 MiB** | ~60% |
| `index.json` | **71.3 MiB** | ~39% |
| `meta.json` | **0.06 MiB** | ~0% |

**index/content ratio ≈ 0.647** (~0.65×). Index is large because inverted terms are stored as JSON string keys → number arrays (~1.86M term entries across pack, ~10.7M postings).

### 3.5 Content field waste (modest)

Across **152 023** units:

| Pattern | Count | Est. savings (one pack) |
|---------|-------|-------------------------|
| `"referencias": []` empty arrays | 148 807 | ~2.6–3 MiB with also dropping bible `index_array` → **~3.1 MiB** total strip |
| `index_array` persisted (bible only) | 35 652 | ~0.7 MiB in bible alone (load stamps it anyway) |
| `meta.json` vs manifest | 125 files | ~62 KiB; **unused at runtime** |
| Pretty JSON | 0 | Already **compact** (`JSON.stringify` no pretty) — **0%** minification left |

### 3.6 Source layers (not offline pack)

| Layer | Disk | Git policy |
|-------|------|------------|
| Padres PDF | ~2.0 GiB | ignored |
| Padres raw | ~91 MiB | ignored |
| Padres clean text | ~87 MiB | **tracked** (re-import source) |
| Crawl HTML cache | ~1.3 GiB | ignored |
| Discoveries JSON | 26 MiB | tracked |

Heavy intermediates are already correctly excluded from git. Local clone still pays if those dirs exist on disk.

### 3.7 Compressibility (transport / alternate packaging)

One pack gzip (per-file gzip-6 of all JSON): **181.6 MiB → ~62.5 MiB (~34%)**.  
That helps **CDN/HTTP** if files were pre-gzipped or server-compressed; raw JSON in APK/git still stores the uncompressed form unless packaging changes.

---

## 4. Compression / simplification options (ranked)

Scoring: **bytes saved** (order of magnitude) · **offline UX risk** · **citas risk** · **effort**.

| # | Option | Bytes (order) | Offline UX | Citas (`documentId`+`unitIndex`) | Effort | Verdict |
|---|--------|---------------|------------|----------------------------------|--------|---------|
| A | **Keep dual roots but stop tracking one in git** (canonical `documentos/corpus` + CI/copy-into-assets on build) | **~184 MiB** off git working tree + large history relief over time | None if copy is reliable in CI | None if copy preserves order/IDs | Medium (build script, writer/CI, docs) | **Best structure win** for repo weight |
| B | **Single logical root** (`documentos/corpus` only; Angular assets symlink or build copy) | Same as A for git; writers simplify | None if build always materializes assets | None | Medium–high | Same class as A; prefer explicit copy over fragile symlink on Windows/Android CI |
| C | **Delete / never commit work copies** (`scripts-descarga/documentos`) | **~187 MiB** local only (already gitignored) | None | None | Trivial | Do anytime locally; document “regenerate on scrape” |
| D | **Omit runtime `meta.json` from ship pack** (keep only manifest) | **~62 KiB** × roots | None (unused) | None | Low | Micro; optional hygiene |
| E | **Strip empty `referencias:[]` + non-persisted `index_array`** on write | **~3 MiB** / root | None if loader tolerates missing keys (it does) | None | Low | Small win; good write_corpus hygiene |
| F | **HTTP gzip / Brotli** at CDN/nginx for `assets/corpus/**` | **~2–3×** transfer; disk on client may still store inflated JSON in SW cache | Improves first download; offline cache size depends on browser | None | Low (ops) | **Do for web**; does not shrink APK |
| G | **Client rebuild index from content** (drop shipped `index.json`) | **~71 MiB** / root | **High** — first search/open of large books slow; memory spikes; offline search until rebuild fails | None if unit order unchanged | High | **Not recommended** for Patristic-heavy pack |
| H | **Binary / MessagePack / custom pack** instead of JSON | **~20–40%** raw; more with custom inverted index | Medium — must rewrite loaders, SW, Electron | Medium if serialization reorders units | High | Premature; hurts legibility of corpus on disk |
| I | **Split pack: core vs optional Patristic download** | Up to **~154 MiB** off default APK/PWA | Medium — offline only for installed subset; product change | None if installed packs keep unit indexes | High (product + sync UI) | Valid long-term; **not** “structure only” |
| J | **Drop padres `clean/` from git** (keep only inventory + regenerate from ignored pdf) | **~87 MiB** git | None for app | None | Medium (reproducibility) | Trade-off: clone smaller vs re-OCR dependency |
| K | **Move OCR revisions/inventories out of corpus root** | ~0.5 MiB + clarity | None | None | Low | Structure hygiene; separate `documentos/corpus-tools/` |
| L | **Git LFS for JSON packs** | Working tree still large; clone bandwidth changes | None | None | Medium | Mixed; LFS helps host, not APK size |
| M | **Delete crawl cache / padres pdf on disk** | **GiB-class** local | None | None | Trivial | Local hygiene only (already ignored) |

### What **cannot** be compressed without losing legibility or offline disposition

1. **Array order of units in `content.json`** — defines `unitIndex` for citas, notes, themes, studies.  
2. **Presence of readable body text** for every shipped document the user can open offline — text *is* the product.  
3. **Shipped inverted index** if product requires **instant offline search** without a rebuild step (current UX).  
4. **Human-inspectable JSON tree** if “legibility” means agents/humans diffing `content.json` — binary packs fail this.  
5. **Lazy-per-document layout** (`documents/<id>/…`) — already the right shape for offline progressive load; flattening into one giant file would **hurt** offline disposition.

### What **can** be compressed safely (structure-focused)

1. **Repo dual-write duplication** (A/B) — largest *source control* win without changing reader UX.  
2. **Ignored intermediates** (C, M) — local disk only.  
3. **Micro payload hygiene** (D, E).  
4. **Transport compression on web** (F).  
5. **Optional product split** (I) if APK size becomes the constraint — separate decision from tree shape.

---

## 5. Recommended “maximum safe compression” target

### Do later (safe, high leverage) — recommended roadmap

1. **Single canonical pack root + materialize ship root at build**  
   - Canonical: `documentos/corpus/` (keeps OCR revisions/tools beside pack).  
   - Ship: `frontend/src/assets/corpus/` **generated/copied**, not dual-edited by hand.  
   - Writers write once; CI/`yarn` script syncs to assets before `ng build` / Capacitor.  
   - **Saves ~184 MiB** from the “second truth” (and ongoing double commits).  
   - Offline contract **unchanged**: still `assets/corpus/manifest.json` + `bodyPath`/`indexPath`.

2. **Keep JSON per-document layout** (do not flatten or binary-pack by default).  
   - Maximizes legibility and lazy offline load.  
   - Already compact JSON.

3. **Write hygiene (small):** omit empty `referencias`, never persist load-time `index_array`, optionally stop shipping `meta.json` if tooling moves to manifest-only.

4. **Web delivery:** ensure gzip/brotli for `assets/corpus/**` on docvat nginx.

5. **Local disk:** do not store crawl cache / padres PDFs in clones that only need the app; work copies remain gitignored.

### Leave alone (for now)

| Leave | Why |
|-------|-----|
| `content.json` unit order & `consecutivo` | Citas estables |
| Shipped `index.json` | Offline search without rebuild |
| Lazy `documents/<id>/` tree | Progressive offline; readable diffs |
| Padres/concilios **clean** text in git (unless policy change) | Reproducible import without re-OCR |
| Full Patristic set in pack | Product choice; 85% of bytes are intentional content |

### Explicit non-recommendations

- **Do not** drop `index.json` to “save 71 MiB” without a product decision to rebuild search on device or go online-only for search.  
- **Do not** merge all documents into one archive as the only ship format — breaks lazy load and legibility.  
- **Do not** reindex units or rename ids as a size tactic.  
- **Do not** put the full corpus only on the Fase 2 API — violates offline-first (AGENTS.md).  
- **Do not** treat “delete `documentos/corpus`” as free without a build-time copy — dual-write is still live in `CORPUS_ROOTS`.  
- **Do not** invent a chatbot/IA packing layer for the corpus (out of v2.0 scope).

### Maximum safe target (summary)

| Layer | Target state |
|-------|----------------|
| **Layout** | Keep `manifest` + `documents/<id>/{content,index}.json` (meta optional) |
| **Source control** | One canonical pack; assets = build artifact or generated tree |
| **Runtime** | Unchanged offline contract + IDB fingerprint |
| **Payload** | Keep indexes; optional ~3 MiB field hygiene; web gzip |
| **Intermediates** | Stay gitignored; not part of “structure compression” of the product |

**Net:** The structure is already close to optimal for **legibility + offline lazy load**. The main compressible waste is **duplicating the entire pack twice in git** (and three times again as build artifacts on disk), not deep nesting or pretty-printing. Bytes of *text content* (especially Patristic) dominate; those cannot shrink without removing corpus or encoding it opaquely.

---

## Appendix A — Offline contract checklist (for implementers)

- [ ] `MANIFEST_URL === 'assets/corpus/manifest.json'`
- [ ] Load uses `meta.bodyPath` / `meta.indexPath` via `resolveAssetPath`
- [ ] IDB fingerprint = `id|bodyPath|indexPath|unitCount`
- [ ] `unitIndex` = array index after `stampIndexArray`
- [ ] Dual-write still lists both roots until single-root migration ships

## Appendix B — Sample dual-root hash pairs (2026-07-18)

| Doc | File | Equal | Size (B) |
|-----|------|-------|----------|
| aa-es | content/index/meta | yes | 18313 / 14065 / 362 |
| cic-es | content/index/meta | yes | 2491825 / 951182 / 309 |
| lg-es | content/index/meta | yes | 97657 / 47291 / 339 |
| bible-pueblo-de-dios-es | content/index/meta | yes | 11763122 / 4862410 / 334 |
| lateran-i-la | content/index/meta | yes | 3185 / 3023 / 334 |

Full inventory and command output: goal scratch `corpus-structure-audit.txt`.

## Appendix C — Writers that touch pack roots

| Module | Behavior |
|--------|----------|
| `scripts-descarga/src/pipeline/write_corpus.ts` | `CORPUS_ROOTS` dual-write + work copy + registry |
| `scripts-descarga/resolve_refs.ts` | Dual roots explicit |
| `scripts-descarga/repair_ocr_*_corpus.ts` | Dual via `CORPUS_ROOTS` |
| `scripts-descarga/fix_bible_labels.ts` | Hardcoded both content paths |
| Import entrypoints (`import_council*.ts`, `import_agustin_volume.ts`, …) | Call `writeCorpusDocument` |
