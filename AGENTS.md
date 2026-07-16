# AGENTS.md — Documentos Vaticanos

Reglas obligatorias para agentes y contribuidores. Prioridad: **no romper offline-first**, **no inventar UI fuera del design system**, **citas estables al corpus**, **push tras cada entrega para disparar el build CI** (§9).

| Superficie | ¿Aplica este documento? |
|------------|-------------------------|
| Web Angular (`frontend/src`, `ng serve`, Docker web) | **Sí, obligatorio** |
| Lector offline / PWA | **Sí** (referencia visual y de datos) |
| Cuenta · estudios · temas · admin (web) | **Sí** |
| Android Capacitor (shell nativo) | No forzar rediseño nativo; la WebView usa el mismo design system |
| Backend (`backend/`) | **Sí** (§3 API, dominio, sync) |
| Scrapers / corpus (`scripts-descarga/`, `documentos/`) | **Sí** (§2 corpus) |

---

## 0. Mapa del monorepo

```text
documentos-vaticanos/
├── frontend/                 # Angular 16 + Capacitor 5 (web + Android WebView)
│   ├── src/app/
│   │   ├── components/       # lector, bnav, wbar, dv-sheet, punto, buscador…
│   │   ├── core/             # auth, corpus, account (API clients)
│   │   ├── pages/            # pantallas enrutadas
│   │   └── services/         # nav, preferencias, anotaciones, sync, back…
│   ├── src/assets/corpus/    # pack offline empaquetado (manifest + documents)
│   └── src/styles.css        # tokens + clases canónicas del handoff
├── backend/                  # Express + Prisma + PostgreSQL (Fase 2, opcional)
│   └── src/routes/           # /api/v1/*
├── documentos/corpus/        # fuente del pack (scrapers escriben aquí y en assets)
├── scripts-descarga/         # scrapers, adapters, write_corpus, refs
├── e2e/                      # Playwright + smoke API
└── docs/
    ├── design/handoff/       # prototipos canónicos
    ├── DEV-DOCKER.md
    └── FASE-2-PLAN.md        # dominio social / API (detalle)
```

**Principio de empaquetado:** una sola base web (HTML/CSS/TS) se sirve como PWA y se empaqueta en Android con Capacitor. No meter lógica de plataforma en plantillas; si hace falta nativo, un solo adaptador (Capacitor plugins).

---

## 1. Arquitectura de aplicación

### 1.1 Capas (frontend)

| Capa | Responsabilidad | Dónde |
|------|-----------------|-------|
| **Corpus (datos)** | Manifest + JSON por documento; única fuente de texto | `assets/corpus/` vía `CorpusService` |
| **Estado local** | Preferencias, progreso, anotaciones, temas offline | `localStorage` (claves abajo) |
| **Cuenta online** | Auth JWT, refs/temas/estudios en servidor, merge | `core/auth`, `core/account`, `SyncService` |
| **UI** | Pantallas del handoff; sin Bootstrap / FA / temas Material de color | `pages/`, `components/`, `styles.css` |

### 1.2 Offline-first (no negociable)

1. **Sin login y sin red** se lee el corpus empaquetado, se busca, se anota y se crean temas locales.
2. La API de Fase 2 **enriquece** (cuenta, nube, estudios, revisión admin); **nunca bloquea el lector**.
3. Si `apiBaseUrl` falla o no hay sesión → UI de cuenta en modo offline; el resto de la app sigue.
4. Tras login: `SyncService` hace merge local→nube (`POST /api/v1/sync/merge`, last-write-wins por `updatedAt`) y reescribe localStorage consolidado.

### 1.3 Citas estables

Toda referencia de usuario, maestro, nota o paso de tema/estudio apunta a:

```text
documentId  +  unitIndex   (índice en content.json; preferido)
             |  consecutivo (label humano: "CIC 27", "Gn 1,1", "LG 16")
```

- `documentId` = id del pack (`cic-es`, `lg-es`, `bible-pueblo-de-dios-es`, …).
- `unitIndex` = `index_array` del artículo (estable post-build del corpus).
- No inventar IDs de cita distintos; no reindexar unidades a mano en la app.

### 1.4 Roles (Fase 2)

```text
anonymous  →  reader  →  teacher
                 │           └─ admin (cola de revisión 6C–6D)
```

| Rol | Capacidades |
|-----|-------------|
| **anonymous** | Lectura, búsqueda, anotaciones/temas **locales** |
| **reader** | + cuenta, sync, referencias nube, temas, enroll en estudios |
| **teacher** | + publicar estudios, alumnos |
| **admin** | + cola `/admin/revision` (temas en revisión) |

Detalle de dominio: `docs/FASE-2-PLAN.md` + `backend/prisma/schema.prisma`.

### 1.5 Claves de persistencia local (no renombrar sin migración)

| Clave | Contenido |
|-------|-----------|
| `reader.prefs.v1` | Tema, fuente, tamaño, line-height, max-width, keepAwake |
| `dv.narr.prefs.v1` | Narrador por dispositivo: `grokEnabled`, `voiceId` (Ajustes · Narrador) |
| `document_id` / `article_selected` / `actual_index` | Posición de lectura |
| `nav_stack` | Pila «volver a la cita» |
| `dv_anotaciones_v1` | Subrayados / notas / marcadores |
| `themes.user` | Temas personales offline |
| `dv.favs` | Favoritos de biblioteca |
| `dv.lesson.<studyId>` | Progreso de lecciones (Aprendizaje) |
| Backup | Export/import versionado desde Ajustes (`BackupService`) |

Prefijo histórico del mock de diseño: `dv.*` (ver `docs/design/handoff/ARQUITECTURA.md`). Preferir las claves ya usadas en servicios; no duplicar almacenamiento del mismo dato.

### 1.6 Servicios canónicos (reutilizar, no clonar)

| Servicio | Uso |
|----------|-----|
| `CorpusService` | Manifest + carga lazy de documentos |
| `NavigationService` | Rutas de lectura, pila de citas |
| `ReaderPreferencesService` | Tema/fuente → `data-reader-theme` / `data-reader-resolved` en `<html>` |
| `AnotacionesService` | Notas/subrayados locales |
| `SyncService` | Merge al login |
| `BackService` | Back físico / gesto (Grupo 7A); overlays se registran aquí |
| `AuthService` + interceptor | JWT Bearer a `/api/v1` |
| `ReferencesService` / `ThemesService` / `StudiesService` | API de cuenta |

### 1.7 Shell de chrome (qué va en cada pantalla)

| Contexto | Chrome |
|----------|--------|
| Lectura inmersiva (`/leyendo/…`) | Sin `.bnav`; topbar/fbar del lector; web ≥1024px: `app-wbar` mode `reader` |
| Inicio · Biblioteca · Buscar | Flujo lectura; body `reader-mode`; sin navbar global legado |
| Producto (estudio, cuenta, padres…) | `app-fbar` + `app-bnav` (móvil); `app-wbar` mode `nav` en desktop |
| Auth | `app-wbar` mode `auth` cuando aplique |

Rutas inmersivas (sin chrome de producto exterior): inicio, biblioteca, buscar, lector — ver `PagesComponent.isImmersiveRoute`.

---

## 2. Corpus y scrapers

### 2.1 Pack offline

- Fuente de verdad escrita por pipeline: `documentos/corpus/` **y** copia en `frontend/src/assets/corpus/`.
- Entrada: `manifest.json` → lista de `DocumentMeta` (`id`, `title`, `shortTitle`, `kind`, `locale`, `sourceUrl`, `bodyPath`, `indexPath`, `unitCount`, …).
- Por documento: `content.json` (unidades/artículos) + `index.json` (índice de búsqueda / `indice_por_punto`).
- Esquema: `scripts-descarga/models/corpus.model.ts` y `frontend/src/app/core/corpus/corpus.models.ts` (mantener alineados).

### 2.2 Reglas al escribir corpus (`write_corpus` / adapters)

1. Persistir **`sourceUrl`** desde `seedUrls[0]` (u origen oficial).
2. `title` = nombre completo oficial; `shortTitle` = abreviatura (DV, LG, CIC…).
3. Unidades con `consecutivo` + `contenido` + `referencias` cuando existan.
4. No borrar del manifest documentos ajenos al scrape actual (merge).
5. Tras scrape de magisterio: resolver refs cruzadas (`resolve:refs`) cuando corresponda.
6. Registry multi-fuente: `scripts-descarga/config/sources.json` + adapters en `src/adapters/`.
7. **Concilios ecuménicos** (`kind: council`, latín `*-la`): inventario y clean en `documentos/concilios-source/` (misma plantilla que Padres: `pdf/` → `raw/` → `clean/` → corpus). Import: `npm run concilios:import -- --id <id>`. Vat. II ES document-level ya en corpus; no reimportar.
8. **Imagen → texto (obligatorio):** la app solo empaqueta JSON de lectura. PDF con capa de texto → `extract_source_text.ts` / `pdftotext`. PDF solo imagen → `ocr_volume.sh` (tesseract; Padres `spa_fast`, Concilios `lat`/`lat+eng`). Preferir Archive.org `*_djvu.txt` cuando exista (ya OCR). Nunca servir páginas escaneadas en el lector.
9. **Concilios ES:** packs `*-es` paralelos a `*-la`; `sourceNote` debe indicar traducción generada por IA (no oficial). Import: `npm run concilios:import-es`. No reasignar `doc-codes` al ES (citas → latín). Vat. II ES oficiales ya en corpus.

### 2.3 UI de documentos

- En listados, búsqueda y chrome del lector mostrar **`meta.title` (completo)**, no solo `shortTitle`.
- `shortTitle` solo como badge secundario o rutas legacy.
- Si hay `locale` + `sourceUrl`: enlace **`{Idioma} · fuente`** (`.app-lang-link` / `.reader-chrome-lang`) en pestaña nueva.

---

## 3. Backend (Fase 2)

- Stack: **Express + Prisma + PostgreSQL**, prefijo **`/api/v1`**.
- Auth: `POST /auth/google` (idToken; en dev `DEV_AUTH_BYPASS` con `dev:email:name`); JWT access + refresh.
- Rutas principales: `health`, `auth`, `me`, `references`, `themes`, `studies`, `sync`, `uploads`.
- Uploads: multer + optimización; estáticos en `/uploads`.
- Temas: `reviewStatus` (`none|pending|approved|changes|rejected`) + cola admin.
- Anotaciones nube: modelo `Anotacion`, PK `(userId, id)` cliente; sync merge last-write-wins.
- **No** exponer chatbot ni endpoints de IA en v2.0.

Detalle y contrato: `docs/FASE-2-PLAN.md`. Esquema vivo: `backend/prisma/schema.prisma`.

---

## 4. Arquitectura de pantallas (handoff canónico)

### 4.1 Fuente de verdad visual

| Archivo | Uso |
|---------|-----|
| `docs/design/handoff/pantallas-diseno-src.html` | **Canónico**: 34 pantallas (1A–6D) + paleta |
| `docs/design/handoff/app-src.html` | Legado: lectura (subconjunto) |
| `docs/design/handoff/pantallas-src.html` | Legado: producto 1B–1E (subconjunto) |
| `docs/design/handoff/ARQUITECTURA.md` | Capas web/Capacitor + `dv.*` |
| `docs/design/handoff/README.md` | Índice del handoff + Grupo 7 |
| `frontend/src/styles.css` | Tokens + clases del diseño **en código** |

Copiar **nombres de clase y medidas** del HTML canónico. No inventar `dv-*` / `app-*` nuevos si ya existe clase de diseño. Textos de portada del handoff no se reescriben sin actualizar el diseño.

### 4.2 Flujo de lectura (3A · 3D · 3E · 2A · 2B · 3F · 4A · 4B)

```text
/inicio (3A)  →  /biblioteca (3D)  →  /documento/:id (2A)  →  /leyendo/... (2B)
                      ↘ /buscar (3E)
```

- Móvil `.bnav`: ⌂ Inicio · ▤ Biblioteca · ✎ Estudio · ☰ Ajustes — **no** en el lector inmersivo.
- Ajustes de lectura: `.sheet` (3F); selección `.pop`/`.selx` (4A); nota `.sheet` (4B).
- Clases lectura: `.topbar .search .docrow .dt .dm .chev` · `.reader .rpaper .rhead .rtxt .rfoot` · `.toc .tsec .dcover .dtitle .dsub .dkind` · `.sheet .pop .popb .selx .notearea` · `.bnav .bitem .bico`

### 4.3 Flujo producto (rutas ↔ pantallas)

| Ruta | Pantalla diseño |
|------|-----------------|
| `/cuenta` | 1B Acceso · 3H Perfil/ajustes (vistas internas crear/recuperar 3B·3C) |
| `/estudio` · `/estudios` | 1C Estudio |
| `/estudios/:id` · `/estudios/:id/editar` | Detalle / editar estudio |
| `/aprendizaje` | 1D Aprendizaje |
| `/explorar` | 1E Explorar (Maestros \| Temas \| Épocas) |
| `/cuenta/referencias` · `/notas` | 3G Notas y marcadores |
| `/cuenta/temas` | 6A Mis temas (`p-ok` / `p-rev` / `p-no`) |
| `/cuenta/temas/:id` | 3I·4C Tema · 6B cambios · 4D publicar |
| `/padres` · `/padres/:id` | 2C·2D Padres de la Iglesia |
| `/admin/revision` · `/admin/revision/:id` | 6C·6D Cola de revisión |
| `/ajustes` | Preferencias de app/lectura |
| `/documentos/listar` · `/biblioteca` | 3D Biblioteca |
| `/about` | Acerca de |

Web ≥1024px: shell `.wbar .wside .wmain .wcols .wsearch .wname .wmark .wlink` (5A–5H); narrador 5D (`.narr .nfill .play`, Web Speech API).

Clases producto: `.mark .gbtn .field .flabel .primary .fbar .ftitle .dot .card .bookcard .notecard .refcard .quote .prog .mrow .mname .mmeta .avatar .tabs .tab .chip .lrow .lnum .sect .greet .pill .seg .segbtn .badge .p-ok .p-rev .p-no .qrow .com .stepbtn .dlbar .revnote .era .setrow .setk .seth .iconb .dots .dotp`

### 4.4 Grupo 7 — patrones UX móvil (obligatorios)

No añaden pantallas; son **comportamiento**. Complementan 1A–6D.

| # | Patrón | Implementación |
|---|--------|----------------|
| **7A** | Back físico/gesto: cierra overlays antes de navegar; en inicio doble-back para salir | `BackService` (`back.service.ts`) — Capacitor `backButton` + `popstate` |
| **7B** | Higiene PWA/Android: `viewport-fit=cover`, `theme-color`, sin overscroll-bounce | `index.html` + `overscroll-behavior-y: none` en `styles.css` |
| **7C** | Feedback táctil `:active`; áreas táctiles **≥ 48px** | `styles.css` (`.btn:active`, `.gbtn:active`, `.iconb:active`, …) |
| **7D** | Barras auto-ocultables del lector: scroll ↓ oculta, ↑ muestra (umbral 24px) | `lector.component.ts` (`barsHidden`, `scrollAccum`) |
| **7E** | Sheets drag-to-dismiss: ≥ 80px o velocidad ≥ 0.5 px/ms | `DvSheetComponent` |
| **7F** | Transiciones de ruta fade-through; off con `prefers-reduced-motion` | `routeFade` en `app.component.ts` |

Reglas:

1. Todo overlay nuevo (sheet/pop/modal) **registra cierre en `BackService`**.
2. Toda animación nueva respeta `prefers-reduced-motion`.
3. El lector reaparece barras al tocar o al llegar a un extremo del documento.

### 4.5 Componentes de shell reutilizables

| Selector | Rol |
|----------|-----|
| `app-bnav` | Nav inferior móvil |
| `app-fbar` | Top bar de producto (`←` + título) |
| `app-wbar` | Shell desktop (`nav` \| `auth` \| `reader`) |
| `dv-sheet` | Bottom sheet (3F, 4B, …) + 7E |
| `app-lector` / `app-punto` | Lectura por unidades |

**Prohibido:** Bootstrap, Font Awesome, themes Material de color (pink/indigo). `@angular/material` no debe usarse para chrome visual; el look sale de `styles.css` + handoff.

---

## 5. Design system (web) — obligatorio

### 5.1 Tokens

Fuente: prototipos handoff. Código: `frontend/src/styles.css`.

| Token | Uso |
|-------|-----|
| `--app-bg` / `--bg` | Fondo de página |
| `--app-ink` / `--ink` | Texto principal |
| `--app-muted` / `--muted` | Secundario / hints |
| `--app-line` / `--line` | Bordes / divisores |
| `--app-card` / `--card` | Superficies elevadas |
| `--app-btn` / `--app-btnb` | Botones secundarios |
| `--app-acc` / `--app-acc-ink` | Acento / CTA primario |
| `--app-ok` / `--app-danger` | Estados |
| `--paper` | Superficie de lectura (`.rpaper`) |
| `--desk` | Fondo “escritorio” / chrome |
| `--reader-*` | Tipometría y chrome del lector |

**No inventar hex sueltos** en componentes; usar tokens o `color-mix` sobre tokens.

Tipografías: **EB Garamond** (títulos + cuerpo de lectura), **IBM Plex Sans** (chrome UI).  
Variables: `--app-font-serif`, `--app-font-sans`.

### 5.2 Temas

Atributos en `<html>`: `data-reader-theme` (elección) y `data-reader-resolved` (efectivo).

| Valor | Notas |
|-------|--------|
| **`mono`** | Monocromo oscuro — **default** de la app |
| **`claro`** | Claro (papel de UI; lectura sigue con `--paper`) |
| **`sepia`** | Papel cálido (opción de Ajustes) |
| **`oscuro`** | Oscuro cálido |
| **`system`** | Sigue `prefers-color-scheme` |

Migración legado (al cargar prefs): `paper` → `mono`, `night` → `oscuro`.  
Ciclo UI: `mono → claro → sepia → oscuro → system` (`ReaderPreferencesService`).

Todo componente nuevo debe verse bien en **mono, claro, sepia y oscuro** (y system).

### 5.3 Clases reutilizables (preferir a CSS ad hoc)

- Layout: `.app-surface`, `.app-measure`, `.app-card`
- Tipo: `.app-eyebrow`, `.app-title`, `.app-title-lg|md`, `.app-lede`, `.app-muted`, `.app-rule`
- Acciones: `.app-btn`, `.app-btn-primary`, `.app-btn-ghost`, `.app-btn-sm`
- Docs: `.app-doc-row`, `.app-doc-title`, `.app-doc-meta`, `.app-lang-link`
- Estados: `.app-status`, `.app-status-error`
- Lectura: `.reader-surface`, `.reader-chrome`, `.reader-btn`, `.ref-link`
- Handoff: preferir clases de §4.2–4.3 cuando la pantalla sea del prototipo

Si necesitas un patrón nuevo: **añádelo a `styles.css` y documenta aquí**.

### 5.4 Reglas al crear un componente / página

1. Identificar pantalla del handoff (§4) y el chrome (§1.7). **No** reintroducir navbar global en el flujo de lectura.
2. Solo tokens y clases del sistema. Sin Bootstrap / FA / Material de color / hex sueltos.
3. Familia visual del lector: acento cálido, serif en texto largo, sans en chrome.
4. Topbars de lectura/producto: sticky ~56px, `←` + título centrado; sin hamburger en Biblioteca/Lector.
5. Temas: probar al menos `mono` y `claro`.
6. Responsive: lectura primero; táctil ≥ 48px (7C).
7. Overlays → `BackService.register`.
8. Animaciones → `prefers-reduced-motion`.
9. Selectores Angular: `app-*` o `dv-sheet`; clases CSS del **diseño**, no prefijos inventados.
10. Standalone components para shell reutilizable (`bnav`, `wbar`, `fbar`, `dv-sheet`); páginas en `PagesModule` según el patrón existente.

---

## 6. Principios de producto

| Principio | Detalle |
|-----------|---------|
| Offline-first | Corpus + anotaciones + temas locales sin cuenta |
| Online enriquece | Login, sync, estudios, revisión |
| Citas estables | `documentId` + `unitIndex` |
| Sin chatbot en v2.0 | IA conversacional fuera de alcance (aunque `README.plan.md` lo mencione como visión lejana) |
| Fotos controladas | Solo temas/notas de usuario; pipeline de upload del backend |
| Una base web | Capacitor empaqueta la misma UI |

---

## 7. Dev local y tests

```bash
yarn dev              # Docker: postgres + api + web  (ver docs/DEV-DOCKER.md)
yarn dev:build        # rebuild imágenes
yarn dev:api-only     # solo API + Postgres
yarn dev:down
yarn test:api         # smoke e2e backend
yarn test:e2e         # Playwright (profile e2e)
yarn test:scrape      # scrapers offline (fixtures)
yarn test:refs        # parser de referencias
```

| URL | Servicio |
|-----|----------|
| http://localhost:4200 | Angular |
| http://localhost:3000/api/v1/health | API |

Login dev (con `DEV_AUTH_BYPASS`): UI **Cuenta** o

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/google \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"dev:yo@example.com:Mi Nombre"}'
```

Android (host, no en Compose por defecto):

```bash
cd frontend && npm run build:cap
cd android && ./gradlew assembleDebug
```

---

## 8. Checklist rápido (PR / agente)

### UI / design system
- [ ] ¿Colores solo con tokens?
- [ ] ¿Clases del handoff / sistema en vez de CSS one-off?
- [ ] ¿Se ve bien en `mono` y `claro` (ideal: también sepia/oscuro)?
- [ ] ¿Chrome correcto (bnav/fbar/wbar) y lector sin bnav?
- [ ] ¿Overlay nuevo registrado en `BackService`?
- [ ] ¿Animaciones respetan `prefers-reduced-motion`?

### Contenido / corpus
- [ ] ¿Títulos de documentos **completos** (`meta.title`)?
- [ ] ¿Enlace idioma/fuente si hay `sourceUrl`?
- [ ] ¿Citas con `documentId` + `unitIndex`?
- [ ] ¿Corpus escrito en `documentos/corpus` **y** assets (si aplica scrape)?

### Producto / backend
- [ ] ¿Sigue funcionando **sin** API / sin login?
- [ ] ¿Sync o persistencia local sin romper claves existentes?
- [ ] ¿Roles respetados (reader/teacher/admin)?
- [ ] ¿Android WebView sin regresión forzada del shell nativo?

### Alcance
- [ ] ¿Sin chatbot / sin Material “pink” / sin reintroducir Bootstrap o FA?

### Entrega / CI
- [ ] ¿Commit + **push** a la rama de trabajo para disparar el build remoto?

---

## 9. Flujo de agente: push para disparar el build

**Obligatorio para agentes** en este repo: al terminar un cambio coherente y verificado, **haz commit y `git push`** a la rama actual (tracking de `origin`). El push es lo que dispara el pipeline de build/deploy (n8n sidecar `DOCVAT-build`, entrada `.ci-build.sh` → web + APK + Electron + deploy a docvat).

| Paso | Qué hacer |
|------|-----------|
| 1. Verificar | Tests/build locales relevantes al cambio; checklist §8 |
| 2. Commit | Mensaje claro (estilo conventional commits si encaja: `feat:`, `fix:`, `docs:`, …). No commits vacíos ni secretos |
| 3. **Push** | `git push -u origin HEAD` (o push de la rama ya trackeada). **Sin esto no hay build CI** |
| 4. No force-push | Prohibido `--force` / `--force-with-lease` a `master`/`main` salvo petición explícita del humano |

Reglas:

1. **Tras cada entrega** (feature, fix, cambio de docs de agente que deba quedar en remoto): push al acabar, no dejar el trabajo solo en local.
2. No acumular varios entregables sin push “por si acaso”: un push por unidad de trabajo terminada es lo esperado.
3. Si el push falla (auth, red, non-fast-forward): reportar el error; no reescribir historial remoto sin indicación del usuario.
4. WIP a medias o experimentos rotos: no push a ciegas; o commit en rama de trabajo con el estado honesto, o dejar local y avisar.
5. `master`/`main`: push solo si la tarea lo implica; en ramas de feature (p. ej. `typescript-migration`) push a esa rama.

Entrypoint CI de referencia: `.ci-build.sh`. Artefactos de descarga pública y deploy: ver `scripts/package-*.sh` y `deploy/`.

---

## 10. Dónde leer más

| Tema | Documento |
|------|-----------|
| Pantallas y markup | `docs/design/handoff/pantallas-diseno-src.html` |
| Capas mock `dv.*` | `docs/design/handoff/ARQUITECTURA.md` |
| Fase 2 dominio/API | `docs/FASE-2-PLAN.md` |
| Docker dev | `docs/DEV-DOCKER.md` |
| Scrapers | `scripts-descarga/README.md` |
| Schema DB | `backend/prisma/schema.prisma` |
| Changelog reciente | `CHANGELOG.md` (sección Unreleased) |
| CI / build remoto | `.ci-build.sh`, §9 (push obligatorio) |
