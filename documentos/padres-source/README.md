# Padres de la Iglesia — fuente → corpus

Extra respecto al crawler de Curia Romana. Convierte textos de la carpeta de Google Drive a **texto plano ordenado** en el formato del corpus offline (`meta.json` + `content.json` + `index.json` + entrada en `manifest.json`).

## Fuente y atribución

- **Compilador de la colección digital:** P. **A. Cedano** (sacerdote). Reunió los PDF/obras en Google Drive.
- Carpeta Drive: [Padres de la Iglesia](https://drive.google.com/drive/folders/0B0jwB_jVsocpfk1vZDNVZDFDZ3ZmRXY2U3QzOFlDT0Vsd2JVUFlZYWNHTlQtZ3BMZGlkLVk?resourcekey=0--spF3bWA975-d6iKFQ4mPA)
- Inventario: `inventory/sources.json`
- Volúmenes de Agustín: `inventory/agustin-volumes.json`

En cada `meta.json` del corpus:

| Campo | Contenido |
|-------|-----------|
| `author` | Padre / autor de la obra |
| `compiler` | `A. Cedano` |
| `sourceUrl` | Enlace al archivo en Drive |
| `sourceNote` | Procedencia + edición de referencia |

## Layout

| Ruta | Contenido |
|------|-----------|
| `inventory/` | Catálogo de obras y estados |
| `pdf/` | PDFs descargados (gitignored) |
| `raw/` | Texto crudo de `pdftotext` (gitignored) |
| `clean/` | Texto limpio listo para importar |

## Pipeline (descarga ≠ OCR/import)

Las **descargas** y el **procesamiento** (pdftotext / OCR → corpus) son colas **independientes** para solapar red y CPU.

```bash
cd scripts-descarga

# Terminal A — solo descarga (no OCR)
npm run padres:download                 # una pasada, 4 en paralelo
# o en bucle:
npm run padres:download:daemon          # re-escanea inventory cada 90s

# Terminal B — solo proceso local (no descarga)
# Text PDF: pdftotext → corpus
# Image PDF: OCR → corpus
bash batch_agustin_pending.sh --skip-download --ns 34,35,38
# o pool OCR global:
npm run padres:ocr-fast

# Agustín por tomo (descarga+import si hace falta)
npm run padres:agustin -- --n 15
```

Inventario de cola de descarga: `inventory/download-queue-state.json`.  
PDFs: `pdf/agustin-N.pdf` (gitignored).

### Una obra suelta (no Agustín)

```bash
# 1) Descargar PDF (curl Drive)
./download_drive_pdf.sh <fileId> nombre.pdf [resourceKey]
# 2) Extraer + limpiar
npm run padres:extract -- --from-inventory carta-diogneto
# 3) Importar al corpus
npm run padres:import -- --from-inventory carta-diogneto
# Atajo Diogneto
npm run padres:diogneto
```

Opciones de segmentado (`splitMode`):

- `roman-chapters` — caps. I., II., … (Diogneto)
- `numbered-sections` — párrafos `1. …` + títulos CATEQUESIS/LIBRO
- `paragraphs` — saltos de párrafo + tope de longitud (~2500 chars)

## Estado

| Obra | corpusDocId | units | Estado |
|------|-------------|-------|--------|
| Carta a Diogneto | `carta-diogneto-es` | ~17 | importado · comp. A. Cedano |
| Cirilo · Catequesis | `cirilo-jerusalen-catequesis-es` | ~1015 | importado · comp. A. Cedano |
| Clemente · Pedagogo | `clemente-alejandria-pedagogo-es` | ~776 | importado · comp. A. Cedano |
| Cipriano · Cartas | `cipriano-cartas-es` | ~829 | importado · comp. A. Cedano |
| Gregorio · Gran Catequesis | `gregorio-nisa-gran-catequesis-es` | ~250 | importado (OCR) · comp. A. Cedano |
| Agustín · Confesiones (t.2) | `agustin-02-confesiones-es` | ~1952 | importado · BAC · Cedano |
| Agustín · De Trinitate (t.5) | `agustin-05-de-trinitate-es` | ~3030 | importado · BAC · Cedano |
| Agustín · Ciudad de Dios I–II | `agustin-16/17-…` | ~3300 c/u | importado · BAC · Cedano |
| Agustín · Primeros escritos, Sermones I, Cartas I | `agustin-01/07/08-…` | ~2k c/u | importado · BAC · Cedano |
| Agustín BAC 1–40 (todos) | ver `agustin-volumes.json` | — | importado · BAC · Cedano (OCR en tomos solo imagen, p. ej. 31–32) |

## Kind en el corpus

`kind: "patristic"` — se muestra en Biblioteca como «Padres de la Iglesia».

## Notas

- No se empaquetan PDF en el app: solo JSON de texto para lectura offline.
- Muchas traducciones son ediciones modernas (Gredos, BAC, revistas): uso personal / estudio según licencia de cada fuente.
- Paralelo al crawler en curso; no bloquea el pipeline de magisterio.
