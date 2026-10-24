# Doctores de la Iglesia — inventario y fuentes

Catálogo de los **38 Doctores** de la Iglesia (proclamados por el Papa), con obras representativas, vínculo a packs del corpus cuando existen, y **fuentes públicas** candidatas.

## Archivos

| Ruta | Uso |
|------|-----|
| `inventory/doctores.json` | Inventario machine-readable (ids, años, obras, `documentId` / `sourceUrl`) |
| `clean/` | Textos limpios importados al corpus (p. ej. Atanasio EN) |
| `raw/` | Descargas crudas si aplica |

La UI de la app lee el catálogo TypeScript espejo:

- `frontend/src/app/data/doctores.ts`

## Packs en corpus (estado actual)

| Doctor | Pack(s) | Notas |
|--------|---------|--------|
| San Agustín | `agustin-01-…` … `agustin-40-…-es` | Colección BAC / Cedano (no reimportar) |
| San Cirilo de Jerusalén | `cirilo-jerusalen-catequesis-es` | Importado vía padres-source |
| San Atanasio | `atanasio-de-incarnatione-en` | **Nuevo**: NPNF vía New Advent (dominio público) |

El resto de Doctores tiene obras listadas como **pendientes** con URL de fuente cuando hay repositorio público (New Advent, CCEL, newmanreader.org, etc.).

## vatican.va

vatican.va **no aloja** las opera omnia de los Doctores antiguos. Sí publica:

- Homilía de proclamación de **Newman** como Doctor (1 nov 2025, León XIV):  
  https://www.vatican.va/content/leo-xiv/en/homilies/2025/documents/20251101-messa-giubileo-formatori.html
- Litterae Apostolicae de **Ireneo** como Doctor unitatis (latín):  
  https://www.vatican.va/content/francesco/la/apost_letters/documents/20220121-santireneo-dottoredellachiesa.html
- Citas abundantes a Doctores en el Catecismo y el magisterio pontificio.

Esas proclamaciones **no** se tratan como el texto de las obras del Doctor; van como metadata / `proclamationSourceUrl` en la ficha.

## Importar un texto limpio

```bash
cd scripts-descarga
npx ts-node --transpile-only import_plain_text.ts \
  --id <corpusDocId> \
  --title "..." \
  --locale en|es \
  --kind patristic \
  --file ../documentos/doctores-source/clean/<file>.txt \
  --mode numbered-sections \
  --source-url "https://..."
```

Reglas AGENTS.md: dual-write corpus + assets (lo hace `write_corpus`), `sourceNote` honesto, opción de lectura vía ficha de documento.
