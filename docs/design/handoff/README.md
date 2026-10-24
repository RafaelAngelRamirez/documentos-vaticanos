# Handoff de diseño (canónico)

Fuente: bundle *Aplicación Documentos Vaticanos* (Claude Design).

| Archivo | Uso |
|---------|-----|
| `pantallas-diseno-src.html` | **Canónico** — 34 pantallas (1A–6D): lectura, producto, maestro/revisión y web + paleta claro/oscuro |
| `app-src.html` | Legado: app de lectura (Inicio · Biblioteca · Lector) — subconjunto del canónico |
| `pantallas-src.html` | Legado: producto 1B–1E + paleta — subconjunto del canónico |
| `ARQUITECTURA.md` | Capas web/Capacitor y claves `dv.*` |
| `documentos.js` | Catálogo de ejemplo del mock (no sustituye el corpus) |

La implementación Angular debe copiar **nombres de clase y medidas** de estos HTML.

## Grupo 7 — patrones UX móvil (7A–7F)

El Grupo 7 no tiene markup propio: documenta **comportamiento** (7A back físico · 7B higiene PWA/Android · 7C feedback táctil · 7D barras auto-ocultables · 7E drag-to-dismiss · 7F transiciones de ruta). Definición canónica en `AGENTS.md` §4.4 → «Grupo 7 — patrones UX móvil».

Ver `AGENTS.md` en la raíz del repo (mapa monorepo, capas, design system, corpus, API).
