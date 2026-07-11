# Fase 2 — Estudios compartidos, roles y cuenta de usuario

## 1. Contexto y principios

La **Fase 1** deja una app de lectura **offline-first** con corpus empaquetado (CIC, Biblia, LG, GS, DV, SC) y referencias locales por:

```text
documentId  +  unitIndex / consecutivo
ej. cic-es + arrayIndex  |  bible-pueblo-de-dios-es + index
```

La **Fase 2** añade capa social y de estudio **opcionalmente online**:

| Principio | Detalle |
|-----------|---------|
| Offline-first | Sin login se lee el corpus completo (comportamiento actual). |
| Online enriquece | Login desbloquea favoritos en la nube, temas propios, estudios, alumnos. |
| Contrato estable | Toda cita de usuario/maestro apunta a `documentId` + `unitRef` del corpus empaquetado. |
| Sin chatbot en esta fase | IA conversacional fuera de alcance; el valor es estructura de estudio + comunidad. |
| Fotos controladas | Solo en temas/notas del usuario; optimizadas al subir (multer + sharp). |

---

## 2. Roles y ciclo de vida del usuario

```text
anonymous  →  reader (Google)  →  teacher (upgrade)
                    │                    │
                    ├─ favoritos         ├─ estudios publicados
                    ├─ temas personales  ├─ alumnos / seguidores
                    └─ notas privadas    └─ responder dudas (v2.1)
```

| Rol | Capacidades |
|-----|-------------|
| **anonymous** | Lectura offline, búsqueda, refs del corpus. |
| **reader** | Todo lo anterior + cuenta Google; **bookmarks/referencias personales**; **temas propios** (con foto opcional); seguir maestros; copiar/clonar un estudio a su biblioteca personal. |
| **teacher** | Todo lo de reader + **publicar estudios**; invitar/aceptar **alumnos**; ver lista de seguidores; (opcional v2.1) hilos de dudas por paso. |

### Upgrade a maestro

- Flujo: Settings → “Convertirme en maestro” → aceptar términos (uso pastoral/educativo).
- Persistencia: `User.role = 'teacher'`, `teacherProfile` (bio corta, visibilidad).
- Sin pago en v2.0 (flag `teacherRequestedAt` / `teacherSince` para métricas).
- Revocación admin (futuro) fuera de v2.0.

---

## 3. Modelo de dominio

### 3.1 Identidad

```ts
User {
  id: uuid
  email: string
  name: string
  pictureUrl?: string          // de Google
  googleSub: string            // único
  role: 'reader' | 'teacher'
  teacherSince?: Date
  createdAt, updatedAt
}
```

### 3.2 Referencias personales (bookmarks)

```ts
PersonalReference {
  id: uuid
  userId: uuid
  documentId: string           // corpus id: cic-es, lg-es, …
  unitIndex: number            // array index en content.json (estable post-build)
  unitLabel?: string           // cache display: "CIC 27", "Gn 1,1", "LG 16"
  note?: string                // nota corta del usuario
  tags?: string[]
  createdAt
}
// UNIQUE(userId, documentId, unitIndex)
```

### 3.3 Tema personal (ruta de estudio del lector)

Un “tema” es la construcción personal del usuario (no necesariamente pública).

```ts
Theme {
  id: uuid
  ownerId: uuid
  title: string
  description?: string
  coverImageKey?: string       // S3/local path post-multer
  visibility: 'private' | 'unlisted' | 'public'  // v2.0: private por defecto
  steps: ThemeStep[]           // ordenados
  createdAt, updatedAt
}

ThemeStep {
  id: uuid
  themeId: uuid
  order: number
  documentId: string
  unitIndex: number
  unitLabel?: string
  userComment?: string         // comentario del dueño del tema
  // no incluye dudas de terceros en v2.0
}
```

### 3.4 Estudio de maestro (compartible con alumnos)

```ts
Study {
  id: uuid
  teacherId: uuid
  title: string
  description?: string
  coverImageKey?: string
  status: 'draft' | 'published' | 'archived'
  steps: StudyStep[]
  publishedAt?: Date
}

StudyStep {
  id: uuid
  studyId: uuid
  order: number
  documentId: string
  unitIndex: number
  unitLabel?: string
  teacherNote?: string         // guía del maestro
}

Enrollment {                   // alumno ↔ estudio / maestro
  id: uuid
  studyId?: uuid               // seguir un estudio concreto
  teacherId: uuid
  studentId: uuid
  status: 'active' | 'left' | 'removed'
  createdAt
}
// UNIQUE(studentId, teacherId) o (studentId, studyId) según política
```

**Política v2.0 recomendada:** el alumno se **enrolla a un Study** publicado; opcionalmente “seguir maestro” = ver todos sus estudios publicados.

### 3.5 Fotos (multer + optimización)

```text
POST /api/uploads/image
  multipart field: "image"
  middleware: multer (memory o disk temp)
  pipeline: sharp → resize max 1600px, jpeg/webp quality ~80, strip EXIF
  store: local ./uploads (dev) o S3/R2 (prod)
  response: { key, url, width, height, bytes }
```

Límites: MIME allowlist (`image/jpeg`, `image/png`, `image/webp`), max **5 MB** raw, max **1** imagen por request.

---

## 4. Auth: Google estable

### 4.1 Flujo recomendado (web + Capacitor)

```text
App  →  Google Sign-In (OAuth 2 / GIS / @codetrix-studio/capacitor-google-auth)
     →  idToken (JWT de Google)
     →  POST /api/auth/google { idToken }
Backend verifica idToken con google-auth-library (audience = clientId)
     →  upsert User por googleSub
     →  emite access JWT (15m–1h) + refresh token (httpOnly cookie o secure storage)
```

| Superficie | SDK |
|------------|-----|
| Angular web | Google Identity Services (button / One Tap) o auth-code + backend |
| Capacitor Android | Plugin Google Auth nativo → mismo `idToken` al backend |

### 4.2 Seguridad

- Verificación **solo en servidor** del `idToken` (nunca confiar en el cliente).
- JWT de app firmado con secreto/RSA; claims: `sub` (userId), `role`, `email`.
- Refresh rotativo; logout invalida refresh.
- CORS estricto; rate-limit en `/auth/*` y `/uploads/*`.
- En Android: configurar OAuth client IDs (web + Android SHA-1) en Google Cloud Console.

### 4.3 Estados de la app

```ts
// environment
apiBaseUrl: 'https://api.example.com' | 'http://localhost:3000'
googleClientId: '....apps.googleusercontent.com'
authEnabled: true
```

Si `apiBaseUrl` vacío o red cae → UI de cuenta en modo “solo offline”; no bloquear lector.

---

## 5. API (borrador REST)

Prefijo `/api/v1`. Auth: `Authorization: Bearer <access>`.

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/auth/google` | public | Login/registro con idToken |
| POST | `/auth/refresh` | public | Nuevo access |
| POST | `/auth/logout` | auth | Invalida refresh |
| GET | `/me` | auth | Perfil + role |
| POST | `/me/upgrade-teacher` | reader | Pasa a teacher |
| GET/POST | `/me/references` | reader+ | CRUD bookmarks |
| DELETE | `/me/references/:id` | owner | |
| GET/POST | `/me/themes` | reader+ | Temas personales |
| PATCH/DELETE | `/me/themes/:id` | owner | |
| PUT | `/me/themes/:id/steps` | owner | Reordenar/reemplazar steps |
| POST | `/uploads/image` | auth | multer+sharp |
| GET | `/studies` | public/auth | Listar publicados (paginado) |
| GET | `/studies/:id` | public si published | Detalle + steps |
| POST | `/studies` | teacher | Crear draft |
| PATCH | `/studies/:id` | teacher owner | |
| POST | `/studies/:id/publish` | teacher owner | |
| POST | `/studies/:id/enroll` | reader | Alumno se apunta |
| GET | `/me/enrollments` | reader | Estudios inscritos |
| GET | `/teachers/:id/students` | teacher self | Lista alumnos |
| GET | `/health` | public | |

**Idempotencia:** enroll y bookmarks con unique constraints.

---

## 6. Arquitectura técnica

```text
┌─────────────────────┐     JWT      ┌──────────────────────┐
│ Angular + Capacitor │ ───────────► │ API Node (Nest/Express)│
│ corpus offline      │              │ PostgreSQL             │
│ AuthService         │ ◄─────────── │ Redis (refresh opcional)│
│ StudyService        │   JSON       │ uploads/ o S3          │
└─────────────────────┘              └──────────────────────┘
         │
         └── assets/corpus/**  (sin depender de API para leer textos)
```

### 6.1 Stack recomendado (pragmático)

| Capa | Elección v2.0 |
|------|----------------|
| API | **NestJS** o **Express + TypeScript** (preferencia: Express ligero si se quiere velocidad de entrega; Nest si se prioriza estructura a largo plazo) |
| DB | **PostgreSQL** + Prisma o TypeORM |
| Auth Google | `google-auth-library` |
| JWT | `jose` o `@nestjs/jwt` |
| Uploads | **multer** + **sharp** |
| Deploy API | Docker Compose (api + postgres) en el mismo host o VPS |
| App | Angular 16 actual + módulos `auth`, `account`, `studies` |

**Recomendación de implementación:** monorepo  
`/backend` + `/frontend` (ya existe).

### 6.2 Validación de citas al corpus

Al crear bookmark/step, el backend **no** revalida el texto del documento (no tiene por qué re-hostear el corpus). Solo valida forma:

```text
documentId: string no vacío, pattern ^[a-z0-9-]+$
unitIndex: integer >= 0
```

La app cliente resuelve el label desde el corpus local al mostrar.

---

## 7. UX (Angular)

### Pantallas nuevas

1. **Cuenta / Login** — botón “Continuar con Google”; estado logged-in.
2. **Mis referencias** — lista de bookmarks → deep link al lector.
3. **Mis temas** — CRUD; editor de pasos (buscar en corpus + añadir unidad + comentario); foto de portada.
4. **Estudios** — catálogo de estudios publicados; detalle; “Inscribirme”.
5. **Modo maestro** — crear/editar/publicar estudio; lista de alumnos.
6. **Upgrade** — CTA en cuenta.

### Integración con el lector

- En cada `app-punto`: acción “★ Guardar referencia” (si auth).
- En tema/estudio: “Abrir en lector” → `navigateToUnit(documentId, unitIndex)`.
- Stack de citas (Fase 1) se mantiene.

### Offline vs online

| Feature | Offline | Online + auth |
|---------|---------|----------------|
| Leer corpus | sí | sí |
| Bookmarks | local queue (opcional v2.0.1) | sync API |
| Temas / estudios | no crear | sí |
| Fotos | no | sí |

**v2.0 mínimo:** bookmarks/temas requieren red al guardar (sin sync offline compleja).  
**v2.0.1:** cola local + sync al reconectar.

---

## 8. Plan de entrega incremental (PRs)

### F2-PR1 — Backend skeleton + Google Auth
- Repo `/backend`: Express/Nest, health, Postgres, Prisma schema User.
- `POST /auth/google`, JWT, `/me`.
- Env: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `DATABASE_URL`.
- Tests: mock idToken verify.

### F2-PR2 — Frontend Auth
- `AuthService`, interceptor Bearer, pantalla login, botón Google.
- Capacitor Google Auth config (Android client id).
- Guardas de rutas solo en secciones de cuenta (no bloquear lector).

### F2-PR3 — Personal references
- API CRUD + UI “Mis referencias” + ★ en lector.

### F2-PR4 — Temas personales + multer/sharp
- Theme + steps API.
- Upload imagen optimizada.
- Editor de tema en Angular.

### F2-PR5 — Teacher upgrade + Studies
- Upgrade endpoint + UI.
- Study CRUD + publish.
- Catálogo e inscripción de alumnos.
- Vista maestro: alumnos del estudio.

### F2-PR6 — Polish
- Paginación, empty states, rate limits, Docker Compose prod.
- Documentación de OAuth console (web + Android SHA-1).

---

## 9. Esquema DB (Prisma sketch)

```prisma
enum Role { reader teacher }

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  pictureUrl    String?
  googleSub     String   @unique
  role          Role     @default(reader)
  teacherSince  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  references    PersonalReference[]
  themes        Theme[]
  studies       Study[]  @relation("TeacherStudies")
  enrollments   Enrollment[]
}

model PersonalReference {
  id         String @id @default(uuid())
  userId     String
  user       User   @relation(fields: [userId], references: [id])
  documentId String
  unitIndex  Int
  unitLabel  String?
  note       String?
  createdAt  DateTime @default(now())
  @@unique([userId, documentId, unitIndex])
}

model Theme {
  id            String @id @default(uuid())
  ownerId       String
  owner         User   @relation(fields: [ownerId], references: [id])
  title         String
  description   String?
  coverImageKey String?
  visibility    String @default("private")
  steps         ThemeStep[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model ThemeStep {
  id         String @id @default(uuid())
  themeId    String
  theme      Theme  @relation(fields: [themeId], references: [id], onDelete: Cascade)
  order      Int
  documentId String
  unitIndex  Int
  unitLabel  String?
  userComment String?
}

model Study {
  id            String @id @default(uuid())
  teacherId     String
  teacher       User   @relation("TeacherStudies", fields: [teacherId], references: [id])
  title         String
  description   String?
  coverImageKey String?
  status        String @default("draft") // draft|published|archived
  steps         StudyStep[]
  enrollments   Enrollment[]
  publishedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model StudyStep {
  id          String @id @default(uuid())
  studyId     String
  study       Study  @relation(fields: [studyId], references: [id], onDelete: Cascade)
  order       Int
  documentId  String
  unitIndex   Int
  unitLabel   String?
  teacherNote String?
}

model Enrollment {
  id        String @id @default(uuid())
  studyId   String
  study     Study  @relation(fields: [studyId], references: [id], onDelete: Cascade)
  studentId String
  student   User   @relation(fields: [studentId], references: [id])
  status    String @default("active")
  createdAt DateTime @default(now())
  @@unique([studyId, studentId])
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  tokenHash String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## 10. Configuración Google Cloud (checklist)

1. Proyecto GCP → OAuth consent screen (External / Internal).
2. Credenciales:
   - **Web client ID** (Angular + verificación backend).
   - **Android client ID** (package `digital.documentosvaticanos.app` + SHA-1 debug/release).
3. Añadir orígenes autorizados: `http://localhost:4200`, dominio prod, Capacitor `https://localhost`.
4. Variables backend: `GOOGLE_CLIENT_ID` (web; opcional lista de client IDs aceptados).

---

## 11. Fuera de alcance v2.0 (explícito)

- Chatbot / RAG / Ollama.
- Pagos / suscripciones de maestros.
- Dudas/Q&A en tiempo real (v2.1).
- Moderación avanzada de estudios públicos.
- iOS (misma API; Capacitor iOS después).
- Re-hostear textos del Vaticano en el backend (siguen en la app).

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| unitIndex cambia al re-scrapear | Versionar corpus; al publicar release no reordenar units; preferir labels + consecutivo en UI |
| OAuth mal configurado en Android | Documentar SHA-1; aceptar múltiples client IDs en verify |
| Abuso de uploads | Rate limit, sharp, límites de tamaño, auth obligatorio |
| Estudios con citas inválidas | Validar documentId conocido del manifest server-side (lista blanca de ids del corpus actual) |
| App usable sin API | Feature flags; never block lector |

**Lista blanca de `documentId` (v2.0):** leer de un `corpus-ids.json` generado en build del corpus y copiado al backend en deploy.

---

## 13. Criterios de éxito Fase 2

1. Login Google estable en web (y Android si hay client ID).
2. Usuario guarda ≥1 referencia y la reabre en el lector.
3. Usuario crea un tema con ≥2 pasos y foto optimizada (&lt; original).
4. Usuario se upgradéa a maestro, publica un estudio, otro usuario se inscribe.
5. Sin login, el lector offline sigue funcionando igual que Fase 1.

---

## 14. Primer paso de implementación (inmediato)

**F2-PR1:** scaffold `/backend` + Postgres + `POST /auth/google` + `/me` + Docker Compose.

A continuación F2-PR2 (UI login) en paralelo con el diseño de OAuth en Google Console (manual).
