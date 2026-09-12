# Papas + cartas apostólicas — contrato para indexación y citas

Para el agente que indexa / cita párrafos. Este pack **no reindexa** unidades existentes.

## Qué se añadió (sin tocar el corpus de lectura)

| Artefacto | Uso |
|-----------|-----|
| `documentos/corpus/papacy/manifest.json` | 267 pontífices (lista oficial vatican.va) |
| `documentos/corpus/papacy/documents.json` | Catálogo vatican.va (cartas, encíclicas…) |
| Rutas UI `/papas` · `/papas/:id` | Plantilla 2C/2D (`app-era-list` + `app-person-ficha`) |
| `papacy:{popeId}` | Solo ficha de vida en el lector (como `santoral:{id}`) |

**No se modificaron** `documents/*/content.json` ni los `unitIndex` actuales.

## Citas (no negociable)

Siguen siendo:

```text
documentId  +  unitIndex
```

- `popeId` / `ordinal` **no** son claves de cita.
- No reutilizar `unitIndex` entre locales ni entre un papa y su pack.
- Un documento magisterial (p. ej. `md-es`) se cita por su pack, no por `papacy:juan-pablo-ii`.
- La ficha de vida se cita, si hace falta, como `papacy:juan-pablo-ii` + índice de párrafo de la bio.

## Cómo está ligado el corpus actual

`DocumentMeta.sourceUrl` de vatican.va (`/content/{hub}/…` o `/holy_father/…`) se mapea a `popeId`:

| Hub vatican.va | popeId |
|----------------|--------|
| `francesco` | `francisco` |
| `leo-xiv` | `leon-xiv` |
| `benedict-xvi` | `benedicto-xvi` |
| `john-paul-ii` | `juan-pablo-ii` |
| `paul-vi` | `pablo-vi` |
| `john-xxiii` | `juan-xxiii` |
| `leo-xiii` | `leon-xiii` |
| `pius-ix` … `pius-xii` | `pio-ix` … `pio-xii` |

Hoy hay **226 packs** ya en corpus ligados (sobre todo JPII, Pablo VI, León XIII, Juan XXIII). Francisco y Benedicto XVI **aún no tienen packs** de encíclicas/cartas en el corpus.

## Al importar cartas apostólicas nuevas

1. **IDs estables:** `{slug}-{locale}` (p. ej. `desiderio-desideravi-es`), gemelos `en` `hi` `zh` `ar` con el mismo slug y sufijo de locale. No reutilizar el `unitIndex` de otro idioma.
2. **Unidades:** un párrafo / número de vatican.va = una unidad. Preferir `generic_numbered` si hay §§; si es prosa, `vatican_prose` (un `unitIndex` por párrafo de `.testo`).
3. **Metadata mínima:** `kind: magisterium`, `author` = nombre pontificio, `sourceUrl` oficial, `locale`, `sourceNote` si es traducción IA.
4. **Género (opcional, no es cita):** `apostolic-letter` \| `encyclical` \| `apostolic-exhortation` \| `apostolic-constitution` \| `motu-proprio`.
5. **Después de escribir el pack:** `popeId` se infiere otra vez de `sourceUrl` al regenerar `npm run papacy:offline`. No hace falta editar a mano el array de documentos del papa.
6. **No** meter el HTML crudo en el lector. Solo JSON de unidades.
7. **Paridad de locales §2.5:** planificar `es` `en` `hi` `zh` `ar`; no fingir un locale que no existe.

## Cola de descarga (cartas apostólicas)

El catálogo vive en `documentos/papacy-source/inventory/apostolic-letters.json` (tras `npm run papacy:scrape-indexes`).

Prioridad sugerida para el scraper (ES oficial, luego twins):

1. Cartas apostólicas / encíclicas de **Francisco** y **Benedicto XVI** (hueco actual del corpus).
2. Cartas apostólicas de **Juan Pablo II** que aún no están (`md`, `nmi`, `tma`, `sa` ya están).
3. León XIV (archivo nuevo en vatican.va).
4. No importar homilías/audiencias/viajes en esta oleada (no son “cartas apostólicas”).

Al indexar un pack nuevo: resolver refs (`resolve:refs`) **después** de escribir unidades, sin reordenar `content.json`.

## Santoral

Si `PopeRecord.saintId` está definido, la ficha enlaza `/santoral/{saintId}`. No duplicar la bio del santo como segundo pack magisterial.

## Qué no hacer

- No reescribir unidades de Agustín / concilios / CIC para “engancharlas” a un papa.
- No usar `unitIndex` de `md-es` como si fuera el de `md-en`.
- No citar `papacy:juan-pablo-ii` cuando el texto es *Mulieris dignitatem* (`md-es`).
- No force-push ni tocar `manifest.json` del corpus de documentos salvo el merge habitual de `write_corpus`.
