# AGENTS.md — Documentos Vaticanos

Reglas obligatorias para agentes y contribuidores que toquen la app **web** (Angular en `frontend/`). Las vistas **Android / Capacitor** pueden seguir su chrome nativo; no forzar rediseño móvil nativo aquí.

## 1. Design system (web) — obligatorio

Fuente de tokens: prototipos de diseño

- `~/Descargas/Documentos Vaticanos (standalone).html`
- `~/Descargas/Pantallas de Diseño (standalone).html`

Implementación en código:

- Tokens globales: `frontend/src/styles.css` (`--app-*` y aliases `--reader-*`)
- Temas: **sepia** (default), **claro/paper**, **oscuro/night**, **system**
- Tipografías: **EB Garamond** (títulos y cuerpo de lectura), **IBM Plex Sans** (chrome UI)

### Tokens (no inventar hex sueltos)

| Token | Uso |
|-------|-----|
| `--app-bg` | Fondo de página |
| `--app-ink` | Texto principal |
| `--app-muted` | Secundario / hints |
| `--app-line` | Bordes / divisores |
| `--app-card` | Superficies elevadas |
| `--app-btn` / `--app-btnb` | Botones secundarios |
| `--app-acc` / `--app-acc-ink` | Acento / CTA primario |
| `--app-ok` / `--app-danger` | Estados |

### Clases reutilizables (preferir antes que CSS ad hoc)

- Layout: `.app-surface`, `.app-measure`, `.app-card`
- Tipo: `.app-eyebrow`, `.app-title`, `.app-title-lg|md`, `.app-lede`, `.app-muted`, `.app-rule`
- Acciones: `.app-btn`, `.app-btn-primary`, `.app-btn-ghost`, `.app-btn-sm`
- Docs: `.app-doc-row`, `.app-doc-title`, `.app-doc-meta`, `.app-lang-link`
- Estados: `.app-status`, `.app-status-error`
- Lectura: `.reader-surface`, `.reader-chrome`, `.reader-btn`, `.ref-link`

### Reglas al crear un componente web nuevo

1. **Usar solo tokens y clases del sistema** (o variables `--app-*` / `--reader-*`). Prohibido Bootstrap `btn-primary` azul, Material “pink”, o grises genéricos `#333` / `#f5f5f5` sin mapear a tokens.
2. **Misma familia visual que el lector**: fondo de lectura, acento cálido, serif en texto largo, sans en chrome.
3. **No mezclar estilos de producto distinto** (p. ej. cards Material con sombras fuertes) salvo wrapping mínimo.
4. **Temas**: el componente debe verse bien en sepia, paper y night (probar con el toggle de tema).
5. **Responsive web**: priorizar lectura y densidad de texto; el menú colapsable del navbar es el patrón de navegación.
6. Si necesitas un patrón nuevo, **añádelo a `styles.css` + documentarlo aquí**, no como CSS aislado en un solo componente sin reutilizar.

### Alcance

| Superficie | ¿Aplica design system? |
|------------|-------------------------|
| Web Angular (`frontend/src`, `ng serve`, Docker web) | **Sí, obligatorio** |
| Lector offline | Sí (ya es la referencia) |
| Cuenta / estudios / temas (web) | Sí — alinear al rediseñar |
| Android Capacitor UI shell | No forzar; respetar si el usuario lo deja bien |
| Backend / scrapers | N/A |

## 2. Documentos: título completo + idioma/fuente

- En listados, búsqueda y chrome del lector mostrar **`meta.title` (nombre completo)**, no solo `shortTitle` (DV, LG, SC…).
- `shortTitle` solo como badge secundario o rutas legacy.
- Cada documento con `locale` + `sourceUrl` (vatican.va u origen oficial) debe mostrar un enlace **`{Idioma} · fuente`** (clase `.app-lang-link` / `.reader-chrome-lang`) que abra la fuente en nueva pestaña.
- Al escribir corpus (`write_corpus`), persistir `sourceUrl` desde `seedUrls[0]`.

## 3. Principios de producto (contexto)

- Lectura **offline-first**; la API de Fase 2 es opcional.
- Citas estables: `documentId` + `unitIndex` / consecutivo.
- Sin chatbot de producto en v2.0.

## 4. Dev local

```bash
yarn dev          # Docker: postgres + api + web
yarn test:api
```

Ver `docs/DEV-DOCKER.md`.

## 5. Checklist rápido (PR / agente)

- [ ] ¿Colores solo con tokens?
- [ ] ¿Títulos de documentos completos?
- [ ] ¿Enlace de idioma/fuente si hay `sourceUrl`?
- [ ] ¿Se ve bien en tema sepia y night?
- [ ] ¿Clases reutilizables en vez de CSS one-off?
- [ ] ¿Android nativo sin regresión forzada?
