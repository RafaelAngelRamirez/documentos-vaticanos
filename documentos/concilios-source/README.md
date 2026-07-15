# Concilios ecuménicos — fuente → texto → corpus → app

Misma **estructura** que `documentos/padres-source/`. Objetivo: **solo texto legible** en el pack offline (nunca PDFs/imágenes en la app).

## Layout (obligatorio)

| Ruta | Contenido | Git |
|------|-----------|-----|
| `inventory/councils.json` | Cola: id, corpusDocId, fuentes, status | versionado |
| `pdf/` | PDFs descargados (escaneos Mansi, DCO…) | **gitignored** |
| `raw/` | Texto crudo: `pdftotext`, OCR tesseract, o `*_djvu.txt` de Archive.org | **gitignored** |
| `clean/` | Texto limpio listo para importar | versionado (packs de lectura) |

```text
pdf/  ──pdftotext──►  raw/  ──clean──►  clean/  ──import_council──►  corpus dual
  │                     ▲
  └──si es imagen───────┘
     ocr_volume.sh (tesseract lat|lat+eng)
```

**Preferencia de fuente (calidad / coste):**

1. **Archive.org `*_djvu.txt`** — ya es OCR de Internet Archive (sin re-OCR local).
2. **PDF con capa de texto** — `pdftotext` (`extract_source_text.ts`).
3. **PDF solo imagen** — `ocr_volume.sh` (tesseract; lang `lat` o `lat+eng`).

## Comandos

```bash
cd scripts-descarga

# 1) Descargar volúmenes de texto (Archive.org)
npm run concilios:download -- --list
npm run concilios:download -- --volume sacrorumconcilio0005joan
npm run concilios:download -- --id nicea-i
npm run concilios:download -- --all

# 2a) PDF con texto → raw + clean
npm run concilios:extract -- --pdf ../documentos/concilios-source/pdf/X.pdf --out-id nicea-i-la

# 2b) PDF imagen → OCR (pdftoppm + tesseract)
npm run source:ocr -- --pdf ../documentos/concilios-source/pdf/X.pdf \
  --doc-id nicea-i-la --source-root concilios-source --lang lat+eng --jobs 6

# 2c) Recortar un concilio desde un dump Mansi grande
npm run concilios:slice -- --id nicea-i

# 3) Importar a la app (manifest dual)
npm run concilios:import -- --id nicea-i
npm run concilios:list
```

## OCR genérico (padres + concilios)

`scripts-descarga/ocr_volume.sh` escribe en el `--source-root` indicado:

```bash
# Padres (español)
./ocr_volume.sh --pdf ../documentos/padres-source/pdf/agustin-31.pdf \
  --doc-id agustin-31-antimaniqueos-2-es --source-root padres-source --lang spa_fast

# Concilios (latín)
./ocr_volume.sh --pdf ../documentos/concilios-source/pdf/trento-la.pdf \
  --doc-id trento-la --source-root concilios-source --lang lat+eng --import
```

`ocr_padres_volume.sh` es un wrapper de compatibilidad hacia `ocr_volume.sh`.

## Kind

`kind: "council"` · locale `la` · Biblioteca: «Concilios ecuménicos».

## Vat. II

Ya en corpus ES document-level (`lg-es`, …). Inventario: `skipped-existing`. No reimportar.

## Español (traducción por IA)

Plan: [`TRANSLATION-ES.md`](./TRANSLATION-ES.md).

```bash
# Estado de clean/*-es.txt
npm run concilios:translate-es -- --status

# Importar ES (añade sourceNote automático «generada por IA»)
npm run concilios:import-es -- --id nicea-i
npm run concilios:import-es -- --all
```

Los packs `*-la` y `*-es` conviven en el corpus. Vat. II ya tiene ES oficiales.

## Nota sobre packs actuales

| Capa | Rol |
|------|-----|
| `raw/*.raw.txt` / `raw/*.mansi-slice.raw.txt` | OCR bruto (Archive.org / tesseract) — evidencia de fuente |
| `clean/*-la.txt` | **Solo texto de lectura** (curado o OCR ya revisado) |

`concilios:slice` / `concilios:process-ocr` escriben evidencia en `raw/` (`*.mansi-slice.raw.txt`, `*.cleaned.staging.txt`).  
**`clean/` de lectura** se mantiene curado si ya es legible; el OCR Mansi no se pega como “Supplementum” (rompe el lector).  
Promoción a clean solo si no hay curado y el score de calidad es alto (`process_council_ocr.ts`).

```bash
# Pipeline OCR Mansi → staging (+ import solo si pasa QA)
npm run concilios:process-ocr -- --ids trento,vat-i
npm run concilios:process-ocr -- --all
```

Pipeline completo a app: fuente imagen/PDF/txt → raw → (QA) clean → `concilios:import` → corpus JSON.
