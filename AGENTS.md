# AGENTS.md — Documentos Vaticanos

Reglas obligatorias para agentes y contribuidores que toquen la app **web** (Angular en `frontend/`). Las vistas **Android / Capacitor** pueden seguir su chrome nativo; no forzar rediseño móvil nativo aquí.

## 0. Arquitectura de pantallas — obligatoria (handoff canónico)

**Fuente de verdad visual** (copiar en el repo):

- `docs/design/handoff/app-src.html` — lectura
- `docs/design/handoff/pantallas-src.html` — producto 1B–1E
- `docs/design/handoff/ARQUITECTURA.md` — capas + `dv.*`
- CSS canónico: `frontend/src/styles/design-reading.css` + `design-product.css`

### Flujo de lectura (app-src)

```
/inicio  →  /biblioteca  →  /leyendo/...
```

Clases: `.home .eyebrow .h1 .lede .btnacc .rule .homefoot` · `.topbar .lib .search .docrow .dt .dm .chev` · `.reader .rstart .rdoc .rend .panel .prow`

### Flujo producto (pantallas-src)

| Ruta | Pantalla diseño |
|------|-----------------|
| `/cuenta` | 1B Acceso (login) / perfil |
| `/estudio` | 1C Estudio (continuar + planes + chips) |
| `/aprendizaje` | 1D Aprendizaje (curso + lecciones) |
| `/explorar` | 1E Explorar (Maestros \| Temas \| Épocas) |

Clases: `.mark .gbtn .field .primary .fbar .ftitle .dot .card .prog .mrow .avatar .tabs .tab .chip .lrow .lnum .sect .greet`

- **Sin Bootstrap / Font Awesome / themes Material de color.**
- Usar **los mismos nombres de clase** del handoff; no inventar `dv-*` / `app-*` nuevos si ya existe clase de diseño.
- Textos de portada del handoff no se reescriben sin actualizar el diseño.

## 1. Design system (web) — obligatorio

Fuente de tokens: prototipos de diseño (mismos archivos del handoff).

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

1. **Respetar la IA de §0** (qué pantalla es, qué chrome lleva). No reintroducir navbar global en el flujo de lectura.
2. **Usar solo tokens y clases del sistema** (o variables `--app-*` / `--reader-*`). **Bootstrap y Font Awesome están eliminados** — no reintroducirlos. Prohibido Material “pink” o hex sueltos sin tokens.
3. **Misma familia visual que el lector**: fondo de lectura, acento cálido, serif en texto largo, sans en chrome.
4. **Topbars de lectura**: patrón sticky 56px, `← back` + título centrado, sin hamburger en Biblioteca/Lector.
5. **Temas**: el componente debe verse bien en sepia, paper y night.
6. **Responsive web**: priorizar lectura; áreas táctiles ≥ 44px.
7. Si necesitas un patrón nuevo, **añádelo a `styles.css` + documentarlo aquí**.

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
