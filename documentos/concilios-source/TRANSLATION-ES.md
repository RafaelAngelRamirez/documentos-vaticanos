# Plan: Concilios latinos → español (traducción por IA)

## Estado de descargas (2026-07)

| Fuente | Estado |
|--------|--------|
| 21 concilios latinos `*-la` en corpus | **Completo** (importados) |
| Mansi Archive.org (`raw/mansi-*.raw.txt`) | **Completo** (~12 vols., ~49 MB) |
| Packs `*-es` de concilios | **Pendiente** (este plan) |
| Vat. II | Ya en ES document-level (`lg-es`, …); **no** re-traducir |

No hace falta descargar más volúmenes para arrancar ES. Opcional más adelante: recortes Mansi más limpios o ediciones críticas.

## Objetivo

Para cada pack latino `foo-la` crear **`foo-es`**:

- Mismo `kind: council`, `locale: es`
- **Misma estructura de unidades** (mismo `unitIndex` / orden) cuando sea posible
- En `meta.sourceNote` (y opcionalmente primera unidad o banner):

> Traducción al español generada por IA a partir del texto latino del corpus (`foo-la`). No es traducción oficial ni edición crítica; úsese solo para estudio y lectura orientativa. El texto de referencia es el pack latino.

## Layout (misma estructura del repo)

```text
documentos/concilios-source/
  clean/
    nicea-i-la.txt          # fuente
    nicea-i-es.txt          # traducción ES
  inventory/councils.json   # entradas gemelas o campo esCorpusDocId
       ↓ import
documentos/corpus/documents/nicea-i-es/
frontend/src/assets/corpus/documents/nicea-i-es/
```

## Pipeline

```bash
cd scripts-descarga

# 1) Generar/actualizar clean/*-es.txt (traducción)
npm run concilios:translate-es -- --id nicea-i
npm run concilios:translate-es -- --all

# 2) Importar al corpus dual
npm run concilios:import-es -- --id nicea-i
npm run concilios:import-es -- --all
```

### Pasos por documento

1. Leer `clean/<id>-la.txt` (o `content.json` de `*-la`).
2. Traducir **unidad a unidad** (respetar `Canon N`, `Sessio N`, títulos).
3. Escribir `clean/<id>-es.txt` con los mismos saltos de bloque.
4. Import con:
   - `corpusDocId`: `<id>-es`
   - `locale`: `es`
   - `title`: título en español (p. ej. «Concilio de Nicea I»)
   - `shortTitle`: igual o español
   - `sourceUrl`: el del pack latino
   - `sourceNote`: disclaimer IA (fijo)
5. Merge en manifests (sin borrar `*-la`).
6. UI: ambos aparecen en Biblioteca; usuario elige latín o español.

## Nota fija (meta)

```text
Traducción al español generada por IA a partir del texto latino del pack «{titleLa}» ({corpusDocIdLa}). No es una traducción oficial de la Santa Sede ni una edición crítica. Destinada a estudio y lectura orientativa; en caso de duda, prevalece el texto latino.
```

Opcional en UI (`catalog.display.ts` / meta line): badge «trad. IA».

## Orden de trabajo

| Oleada | Packs | Prioridad |
|--------|-------|-----------|
| 0 | Piloto: `nicea-i`, `jerusalen` | Probar pipeline + nota |
| 1 | Antiguos 3–9 | Lectura dogmática |
| 2 | Trento, Vat. I | Alto uso |
| 3 | Medievales | Completar serie |
| 4 | QA spot-check | 2–3 unidades/pack al azar |

Vat. II: **omitir** (ya hay ES oficiales de vatican.va).

## Reglas de calidad

1. No inventar cánones que no estén en el latino.
2. Conservar numeración (`Canon 1`, `Sessio 6`).
3. Citas bíblicas: forma habitual en español cuando el latín cita Escritura.
4. Si una unidad es solo título, traducir el título; no rellenar cuerpo.
5. Re-traducir: sobrescribir `*-es` e reimportar (ids estables).

## Fuera de alcance

- Sustituir el latín por el español.
- Publicar la traducción como oficial.
- Chatbot en la app.

## Verificación

- [ ] Existe `meta.json` ES con `sourceNote` del disclaimer
- [ ] `unitCount` ES ≈ `unitCount` LA (± títulos vacíos)
- [ ] Manifest dual lista `*-es` y `*-la`
- [ ] Biblioteca muestra ambos; lectura offline OK
- [ ] Temas mono/claro legibles
