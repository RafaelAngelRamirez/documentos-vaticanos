# Fuente papacy (vatican.va)

Inventario y HTML de la lista oficial de pontífices y de los índices de documentos papales. **No es el corpus de lectura.**

| Ruta | Qué hay |
|------|---------|
| `raw/holy-father-es.html` | Tabla de pontífices (`/content/vatican/es/holy-father.html`) |
| `raw/indexes/` | Índices ES de cartas apostólicas, encíclicas, etc. |
| `inventory/popes.json` | Resumen generado (ids, santoral, corpus) |
| `inventory/apostolic-letters.json` | Catálogo vatican.va (cuando se corre `--scrape-indexes`) |

Pack offline (dual-write, como el santoral):

- `documentos/corpus/papacy/manifest.json`
- `frontend/src/assets/corpus/papacy/manifest.json`

Comandos:

```bash
npm --prefix scripts-descarga run papacy:offline
npm --prefix scripts-descarga run papacy:scrape-indexes
```

Reglas:

1. No reescribir `documentos/corpus/documents/*` ni el array `manifest.json` de documentos desde este pipeline (otros agentes indexan ese corpus).
2. Las citas siguen siendo `documentId` + `unitIndex`. El `popeId` solo agrupa.
3. Bios sintéticas del lector: `papacy:{popeId}` (no colisionan con packs).
4. No inventar vidas: ficha de reinado de vatican.va + bio del santoral si el papa está allí.
